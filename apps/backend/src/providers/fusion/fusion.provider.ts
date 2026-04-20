import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import * as ort from 'onnxruntime-node';
import * as sharp from 'sharp';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { ConfigService } from '../../config/config.service';

// Alphabet from fusion_solar_py captcha_solver_onnx.py
const CAPTCHA_ALPHABET = ['2','3','4','5','6','8','9','a','b','c','d','e','f','g','h','l','r','t','y'];
const CAPTCHA_BLANK = 20;
const NEG_INF = -Infinity;

function getLoginSubdomain(subdomain: string): string {
  if (subdomain.startsWith('region')) return subdomain.slice(8);
  if (subdomain.startsWith('uni')) return subdomain.slice(6);
  return subdomain;
}

// CTC prefix beam search decoder — ported from fusion_solar_py/ctc_decoder.py
function logsumexp(...args: number[]): number {
  if (args.every(a => a === NEG_INF)) return NEG_INF;
  const aMax = Math.max(...args);
  return aMax + Math.log(args.reduce((s, a) => s + Math.exp(a - aMax), 0));
}

function ctcDecode(probs: Float32Array, T: number, S: number, blank: number): number[] {
  // probs is row-major [T, S], values are raw probabilities (0..1)
  const logP = (t: number, s: number) => Math.log(Math.max(probs[t * S + s], 1e-30));

  type BeamVal = [number, number]; // [p_blank, p_no_blank]
  let beam = new Map<string, BeamVal>();
  beam.set('[]', [0.0, NEG_INF]);

  for (let t = 0; t < T; t++) {
    const next = new Map<string, BeamVal>();
    const get = (key: string): BeamVal => next.get(key) ?? [NEG_INF, NEG_INF];

    for (const [pKey, [pb, pnb]] of beam) {
      const prefix: number[] = JSON.parse(pKey);

      for (let s = 0; s < S; s++) {
        const p = logP(t, s);
        if (s === blank) {
          const [cb, cnb] = get(pKey);
          next.set(pKey, [logsumexp(cb, pb + p, pnb + p), cnb]);
          continue;
        }
        const endT = prefix.length > 0 ? prefix[prefix.length - 1] : null;
        const nKey = JSON.stringify([...prefix, s]);
        const [cb, cnb] = get(nKey);
        if (s !== endT) {
          next.set(nKey, [cb, logsumexp(cnb, pb + p, pnb + p)]);
        } else {
          next.set(nKey, [cb, logsumexp(cnb, pb + p)]);
          const [cb2, cnb2] = get(pKey);
          next.set(pKey, [cb2, logsumexp(cnb2, pnb + p)]);
        }
      }
    }

    const sorted = [...next.entries()].sort((a, b) => logsumexp(...b[1]) - logsumexp(...a[1]));
    beam = new Map(sorted.slice(0, 10));
  }

  const [bestKey] = [...beam.entries()].sort((a, b) => logsumexp(...b[1]) - logsumexp(...a[1]))[0];
  return JSON.parse(bestKey) as number[];
}

function encryptPassword(keyData: any, password: string): string {
  const encoded = encodeURIComponent(password);
  const pubKey = crypto.createPublicKey(keyData.pubKey);
  let result = '';
  for (let i = 0; i <= Math.floor(encoded.length / 270); i++) {
    const chunk = encoded.slice(i * 270, (i + 1) * 270);
    if (!chunk) break;
    const enc = crypto.publicEncrypt(
      { key: pubKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha384' },
      Buffer.from(chunk),
    );
    if (result) result += '00000001';
    result += enc.toString('base64');
  }
  return result + keyData.version;
}

@Injectable()
export class FusionProvider implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FusionProvider.name);
  private http: AxiosInstance;
  private jar: CookieJar;
  private sessionActive = false;
  private ortSession: ort.InferenceSession | null = null;
  private keepAliveTimer: NodeJS.Timeout | null = null;
  private readonly KEEP_ALIVE_INTERVAL = 4 * 60 * 1000; // 4 minuti

  constructor(private readonly config: ConfigService) {
    this.jar = new CookieJar();
    this.http = this.createHttp();
  }

  onModuleInit() {
    if (this.config.get().fusion.enabled) {
      this.startKeepAlive();
    }
  }

  onModuleDestroy() {
    this.stopKeepAlive();
  }

  private startKeepAlive() {
    this.stopKeepAlive();
    this.keepAliveTimer = setInterval(() => this.pingSession(), this.KEEP_ALIVE_INTERVAL);
  }

  private stopKeepAlive() {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }
  }

  private async pingSession() {
    if (!this.sessionActive) return;
    try {
      const r = await this.http.get(`${this.apiBase}/rest/dpcloud/auth/v1/keep-alive`);
      const payload = r.data?.payload;
      if (payload) (this.http.defaults.headers as any)['roarand'] = payload;
      if (r.data?.code !== 0) {
        this.logger.warn('Keep-alive FusionSolar fallito, sessione scaduta');
        this.sessionActive = false;
      }
    } catch {
      this.logger.warn('Keep-alive FusionSolar errore, sessione scaduta');
      this.sessionActive = false;
    }
  }

  private createHttp(): AxiosInstance {
    this.jar = new CookieJar();
    return wrapper(
      axios.create({
        jar: this.jar,
        withCredentials: true,
        timeout: 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
          Accept: 'application/json, text/plain, */*',
        },
      }),
    );
  }

  private get subdomain(): string { return this.config.get().fusion.subdomain; }
  private get loginSubdomain(): string { return getLoginSubdomain(this.subdomain); }
  private get apiBase(): string { return `https://${this.subdomain}.fusionsolar.huawei.com`; }
  private get loginBase(): string { return `https://${this.loginSubdomain}.fusionsolar.huawei.com`; }

  private async isSessionAlive(): Promise<boolean> {
    try {
      const r = await this.http.get(`${this.apiBase}/rest/dpcloud/auth/v1/is-session-alive`);
      return r.data?.code === 0;
    } catch { return false; }
  }

  private async getOrtSession(): Promise<ort.InferenceSession> {
    if (this.ortSession) return this.ortSession;
    const { captchaModelPath } = this.config.get().fusion;
    const absPath = path.isAbsolute(captchaModelPath)
      ? captchaModelPath
      : path.resolve(process.cwd(), captchaModelPath);
    if (!fs.existsSync(absPath)) throw new Error(`Modello CAPTCHA non trovato: ${absPath}`);
    this.ortSession = await ort.InferenceSession.create(absPath);
    this.logger.log(`Modello CAPTCHA caricato: ${absPath}`);
    return this.ortSession;
  }

  private async solveCaptcha(imageBuffer: Buffer): Promise<string> {
    // Replicate fusion_solar_py preprocessing:
    // grayscale → /255 → swapaxes(H,W→W,H) → expand [W,H,1] → batch [1,W,H,1]
    const { data, info } = await (sharp as any)(imageBuffer)
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const H = info.height;
    const W = info.width;
    const input = new Float32Array(W * H);
    for (let h = 0; h < H; h++) {
      for (let w = 0; w < W; w++) {
        input[w * H + h] = (data as Buffer)[h * W + w] / 255.0;
      }
    }

    const session = await this.getOrtSession();
    const tensor = new ort.Tensor('float32', input, [1, W, H, 1]);
    // 'label' is optional in this CTC model — Python passes None, ort-node needs an empty tensor
    const labelTensor = new ort.Tensor('float32', new Float32Array(0), [1, 0]);
    const results = await session.run({ image: tensor, label: labelTensor });

    const outputName = session.outputNames[0];
    const out = results[outputName];
    const dims = out.dims as number[];
    // fusion_solar_py: pred=out[0], then decode(pred[0], ...) where pred[0] is [T, S]
    // out[0] shape = [1, T, S] → pred[0] = [T, S]
    let T: number, S: number, offset = 0;
    if (dims.length === 3) {
      // [batch=1, T, S]
      T = dims[1]; S = dims[2]; offset = 0;
    } else if (dims.length === 2) {
      T = dims[0]; S = dims[1]; offset = 0;
    } else {
      throw new Error(`Unexpected CAPTCHA output dims: ${JSON.stringify(dims)}`);
    }

    const probs = (out.data as Float32Array).slice(offset, offset + T * S);
    const indices = ctcDecode(probs, T, S, CAPTCHA_BLANK);
    const text = indices.filter(n => n >= 1 && n <= CAPTCHA_ALPHABET.length).map(n => CAPTCHA_ALPHABET[n - 1]).join('');
    this.logger.log(`CAPTCHA risolto: "${text}"`);
    return text;
  }

  private async login(): Promise<void> {
    const { username, password } = this.config.get().fusion;
    this.http = this.createHttp();
    this.logger.log('Login FusionSolar...');

    // Fetch public key to determine v2 vs v3 login
    const keyResp = await this.http.get('https://eu5.fusionsolar.huawei.com/unisso/pubkey');
    const keyData = keyResp.data;
    let loginUrl: string;
    const loginParams: Record<string, any> = {};
    let loginPassword = password;

    if (keyData.enableEncrypt) {
      loginUrl = `${this.loginBase}/unisso/v3/validateUser.action`;
      loginParams.timeStamp = keyData.timeStamp;
      loginParams.nonce = crypto.randomBytes(16).toString('hex');
      loginPassword = encryptPassword(keyData, password);
    } else {
      loginUrl = `${this.loginBase}/unisso/v2/validateUser.action`;
      loginParams.decision = 1;
      loginParams.service = `${this.apiBase}/unisess/v1/auth?service=/netecowebext/home/index.html`;
    }

    const body: any = { organizationName: '', username, password: loginPassword };

    // First attempt without captcha
    let resp = await this.http.post(loginUrl, body, { params: loginParams });
    let respData = resp.data;

    // If captcha required, solve and retry
    const needsCaptcha = respData?.verifyCodeCreate === true ||
      ((respData?.errorMsg ?? '') as string).toLowerCase().includes('incorrect verification code');
    if (needsCaptcha) {
      this.logger.log('CAPTCHA richiesto, risoluzione...');
      body.verifycode = await this.fetchAndSolveCaptcha();
      resp = await this.http.post(loginUrl, body, { params: loginParams });
      respData = resp.data;
    }

    // Handle errorCode 470 — SSO redirect to finalize session on the customer subdomain
    if (respData?.errorCode === '470') {
      const targetPath: string = respData.respMultiRegionName?.[1] ?? '';
      if (targetPath) {
        await this.http.get(`https://${this.loginSubdomain}.fusionsolar.huawei.com${targetPath}`);
      }
    } else if (respData?.errorMsg) {
      throw new Error(`Login fallito: ${respData.errorMsg}`);
    }

    // Extract roarand (needed for POST requests)
    try {
      const sessionResp = await this.http.get(`${this.apiBase}/unisess/v1/auth/session`);
      const csrfToken = sessionResp.data?.csrfToken;
      if (csrfToken) (this.http.defaults.headers as any)['roarand'] = csrfToken;
    } catch {}

    try {
      const keepAliveResp = await this.http.get(`${this.apiBase}/rest/dpcloud/auth/v1/keep-alive`);
      const payload = keepAliveResp.data?.payload;
      if (payload) (this.http.defaults.headers as any)['roarand'] = payload;
    } catch {}

    this.sessionActive = true;
    this.logger.log('Login FusionSolar riuscito');
  }

  private async fetchAndSolveCaptcha(): Promise<string> {
    const timestamp = Date.now();
    const captchaResp = await this.http.get(
      `${this.loginBase}/unisso/verifycode`,
      { params: { timestamp }, responseType: 'arraybuffer' },
    );

    const captchaText = await this.solveCaptcha(Buffer.from(captchaResp.data));

    // Pre-validate captcha before login
    const preValid = await this.http.post(
      `${this.loginBase}/unisso/preValidVerifycode`,
      { verifycode: captchaText, index: 0 },
    );
    if (preValid.data !== 'success') {
      this.logger.warn(`Pre-validazione CAPTCHA: ${preValid.data}`);
    }

    return captchaText;
  }

  private async ensureSession(): Promise<void> {
    if (this.sessionActive && await this.isSessionAlive()) return;
    this.sessionActive = false;
    await this.login();
  }

  async fetchPlantData(_plantId: string): Promise<{ power: number; energyToday: number }> {
    await this.ensureSession();

    const r = await this.http.get(
      `${this.apiBase}/rest/pvms/web/station/v1/station/total-real-kpi`,
      { params: { queryTime: Date.now(), timeZone: 1, _: Date.now() } },
    );

    if (!r.data?.success) {
      this.sessionActive = false;
      throw new Error(`Errore dati: ${JSON.stringify(r.data)}`);
    }

    const data = r.data.data ?? {};
    this.logger.debug(`FusionSolar power data: ${JSON.stringify(data)}`);

    const power = parseFloat(data.currentPower ?? '0') || 0;
    const energyToday = parseFloat(data.dailyEnergy ?? '0') || 0;

    return { power, energyToday };
  }
}

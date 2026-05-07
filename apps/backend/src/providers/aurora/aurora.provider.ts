import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import { ConfigService } from '../../config/config.service';

const LOGIN_URL = 'https://www.auroravision.net/ums/v1/login?setCookie=true';
const TELEMETRY_BASE = 'https://www.auroravision.net/telemetry/v1/plants';

@Injectable()
export class AuroraProvider implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AuroraProvider.name);
  private http: AxiosInstance;
  private jar: CookieJar;
  private lastLogin: Date | null = null;
  private readonly sessionTtl = 45 * 60 * 1000; // 45 min, ri-login proattivo
  private renewTimer: NodeJS.Timeout | null = null;
  private powerCache = new Map<string, { value: number; readAt: Date }>();

  constructor(private readonly config: ConfigService) {
    this.jar = new CookieJar();
    this.http = wrapper(
      axios.create({
        jar: this.jar,
        withCredentials: true,
        timeout: 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Accept: 'application/json',
        },
      }),
    );
  }

  onModuleInit() {
    // Ri-login proattivo ogni 40 minuti (prima del TTL di 45)
    this.renewTimer = setInterval(() => this.renewSession(), 40 * 60 * 1000);
  }

  onModuleDestroy() {
    if (this.renewTimer) clearInterval(this.renewTimer);
  }

  private async renewSession() {
    if (!this.lastLogin) return;
    try {
      await this.login();
    } catch (e) {
      this.logger.warn(`Rinnovo sessione AuroraVision fallito: ${e.message}`);
      this.lastLogin = null;
    }
  }

  private sessionExpired(): boolean {
    if (!this.lastLogin) return true;
    return Date.now() - this.lastLogin.getTime() > this.sessionTtl;
  }

  private async login(): Promise<void> {
    const { username, password } = this.config.get().aurora;
    this.logger.log('Login AuroraVision...');

    const response = await this.http.get(LOGIN_URL, {
      auth: { username, password },
    });

    if (response.status !== 200) {
      throw new Error(`Login fallito: HTTP ${response.status}`);
    }

    this.lastLogin = new Date();
    this.logger.log('Login AuroraVision riuscito');
  }

  private async ensureSession(): Promise<void> {
    if (this.sessionExpired()) {
      await this.login();
    }
  }

  async fetchPlantData(entityId: string): Promise<{ power: number; energyToday: number; powerReadAt?: string }> {
    try {
      await this.ensureSession();
    } catch (e) {
      this.lastLogin = null;
      throw new Error(`Sessione non disponibile: ${e.message}`);
    }

    const [power, energyToday] = await Promise.all([
      this.fetchPower(entityId),
      this.fetchEnergyToday(entityId),
    ]);

    const cached = this.powerCache.get(entityId);
    return { power, energyToday, powerReadAt: cached?.readAt.toISOString() };
  }

  private async fetchWithRetry<T>(fetcher: () => Promise<T>, retries = 2): Promise<T> {
    let lastError: Error;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await fetcher();
      } catch (e) {
        lastError = e;
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
        }
      }
    }
    throw lastError;
  }

  private startOfDay(): Date {
    // Mezzanotte ora italiana = 22:00 UTC del giorno precedente
    const now = new Date();
    const sdt = new Date(now);
    sdt.setUTCHours(22, 0, 0, 0);
    if (sdt > now) sdt.setUTCDate(sdt.getUTCDate() - 1);
    return sdt;
  }

  private async fetchPower(entityId: string): Promise<number> {
    const now = new Date();

    try {
      const response = await this.fetchWithRetry(() =>
        this.http.get(`${TELEMETRY_BASE}/${entityId}/power/GenerationPower`, {
          params: {
            agp: 'Hour',
            afx: 'Max',
            sdt: this.startOfDay().toISOString(),
            edt: now.toISOString(),
          },
        }),
      );

      const data: { value?: number; units: string; end?: string }[] = Array.isArray(response.data) ? response.data : [];
      const valid = data.filter(d => typeof d.value === 'number');
      this.logger.debug(`Aurora [${entityId}] bucket oggi: ${data.length}, con valore: ${valid.length}`);

      if (valid.length > 0) {
        const last = valid[valid.length - 1];
        const kw = last.units === 'watts' ? last.value / 1000 : last.value;
        const readAt = last.end ? new Date(last.end) : now;
        this.powerCache.set(entityId, { value: kw, readAt });
        return kw;
      }

      // Nessun bucket valido oggi — fallback cache (es. prima dell'alba)
      const cached = this.powerCache.get(entityId);
      if (cached) {
        this.logger.debug(`Aurora [${entityId}] nessun dato oggi, uso cache: ${cached.value.toFixed(2)} kW`);
        return cached.value;
      }

      return 0;
    } catch (e) {
      if (e.response?.status === 401 || e.response?.status === 403) {
        this.lastLogin = null;
      }
      throw new Error(`Errore potenza: ${e.message}`);
    }
  }

  private async fetchEnergyToday(entityId: string): Promise<number> {
    const now = new Date();

    const sdt = new Date(now);
    sdt.setUTCHours(22, 0, 0, 0);
    if (sdt > now) sdt.setUTCDate(sdt.getUTCDate() - 1);

    const edt = new Date(sdt);
    edt.setUTCDate(edt.getUTCDate() + 1);
    edt.setUTCMilliseconds(edt.getUTCMilliseconds() - 1);

    try {
      const response = await this.fetchWithRetry(() =>
        this.http.get(`${TELEMETRY_BASE}/${entityId}/energy/GenerationEnergy`, {
          params: {
            agp: 'Day',
            afx: 'Delta',
            sdt: sdt.toISOString(),
            edt: edt.toISOString(),
          },
        }),
      );

      const data: { value?: number }[] = response.data;
      if (!data || data.length === 0) return 0;
      return typeof data[0].value === 'number' ? data[0].value : 0;
    } catch (e) {
      if (e.response?.status === 401 || e.response?.status === 403) {
        this.lastLogin = null;
      }
      return 0;
    }
  }
}

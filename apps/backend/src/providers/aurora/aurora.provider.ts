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

  async fetchPlantData(entityId: string): Promise<{ power: number; energyToday: number }> {
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

    return { power, energyToday };
  }

  private async fetchPower(entityId: string): Promise<number> {
    const now = new Date();
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

    try {
      const response = await this.http.get(`${TELEMETRY_BASE}/${entityId}/power/GenerationPower`, {
        params: {
          agp: 'Hour',
          afx: 'Max',
          sdt: twoHoursAgo.toISOString(),
          edt: now.toISOString(),
        },
      });

      const data: { value: number; units: string }[] = response.data;
      if (!data || data.length === 0) return 0;

      const last = data[data.length - 1];
      return last.units === 'watts' ? last.value / 1000 : last.value;
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
      const response = await this.http.get(
        `${TELEMETRY_BASE}/${entityId}/energy/GenerationEnergy`,
        {
          params: {
            agp: 'Day',
            afx: 'Delta',
            sdt: sdt.toISOString(),
            edt: edt.toISOString(),
          },
        },
      );

      const data: { value: number }[] = response.data;
      if (!data || data.length === 0) return 0;
      return data[0].value;
    } catch (e) {
      if (e.response?.status === 401 || e.response?.status === 403) {
        this.lastLogin = null;
      }
      return 0;
    }
  }
}

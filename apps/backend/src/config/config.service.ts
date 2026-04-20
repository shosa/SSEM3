import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

export interface AuroraPlantConfig {
  entityId: string;
  name: string;
}

export interface AuroraConfig {
  username: string;
  password: string;
  plants: AuroraPlantConfig[];
  updateInterval: number;
}

export interface FusionConfig {
  enabled: boolean;
  subdomain: string;
  username: string;
  password: string;
  captchaModelPath: string;
  plantName: string;
  plantId: string;
  updateInterval: number;
}

export interface AppConfig {
  aurora: AuroraConfig;
  fusion: FusionConfig;
}

const CONFIG_PATH = path.resolve(process.cwd(), 'config', 'config.json');
const EXAMPLE_PATH = path.resolve(process.cwd(), 'config', 'config.example.json');

const DEFAULT_CONFIG: AppConfig = {
  aurora: {
    username: '',
    password: '',
    plants: [],
    updateInterval: 300,
  },
  fusion: {
    enabled: false,
    subdomain: '',
    username: '',
    password: '',
    captchaModelPath: 'config/captcha_huawei.onnx',
    plantName: 'FusionSolar',
    plantId: 'main',
    updateInterval: 300,
  },
};

@Injectable()
export class ConfigService {
  private readonly logger = new Logger(ConfigService.name);
  private config: AppConfig = DEFAULT_CONFIG;

  constructor() {
    this.load();
  }

  private load() {
    let targetPath = CONFIG_PATH;

    if (!fs.existsSync(targetPath)) {
      if (fs.existsSync(EXAMPLE_PATH)) {
        fs.copyFileSync(EXAMPLE_PATH, targetPath);
        this.logger.log(`Config creata da esempio: ${targetPath}`);
      } else {
        fs.mkdirSync(path.dirname(targetPath), { recursive: true });
        fs.writeFileSync(targetPath, JSON.stringify(DEFAULT_CONFIG, null, 2));
        this.logger.warn(`Config di default creata: ${targetPath}`);
      }
    }

    try {
      const raw = fs.readFileSync(targetPath, 'utf-8');
      this.config = JSON.parse(raw);
      this.logger.log('Configurazione caricata');
    } catch (e) {
      this.logger.error(`Errore lettura config: ${e.message}`);
    }
  }

  get(): AppConfig {
    return this.config;
  }

  save(config: AppConfig) {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
    this.config = config;
    this.logger.log('Configurazione salvata');
  }

  get updateInterval(): number {
    return Math.min(
      this.config.aurora.updateInterval,
      this.config.fusion.enabled ? this.config.fusion.updateInterval : Infinity,
    );
  }
}

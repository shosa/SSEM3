import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PlantState, PlantStatus } from './plant.types';
import { ConfigService } from '../config/config.service';
import { AuroraProvider } from '../providers/aurora/aurora.provider';
import { FusionProvider } from '../providers/fusion/fusion.provider';

@Injectable()
export class PlantsService implements OnModuleInit {
  private readonly logger = new Logger(PlantsService.name);
  private plants = new Map<string, PlantState>();

  constructor(
    private readonly config: ConfigService,
    private readonly aurora: AuroraProvider,
    private readonly fusion: FusionProvider,
  ) {}

  onModuleInit() {
    this.initPlants();
    this.updateAll();
  }

  private initPlants() {
    const cfg = this.config.get();

    for (const plant of cfg.aurora.plants) {
      this.plants.set(`aurora_${plant.entityId}`, {
        id: `aurora_${plant.entityId}`,
        name: plant.name,
        type: 'aurora',
        power: 0,
        energyToday: 0,
        status: 'initializing',
        isOnline: false,
        lastUpdate: null,
        errorMessage: null,
        consecutiveFailures: 0,
      });
    }

    if (cfg.fusion.enabled) {
      this.plants.set('fusion_main', {
        id: 'fusion_main',
        name: cfg.fusion.plantName,
        type: 'fusion',
        power: 0,
        energyToday: 0,
        status: 'initializing',
        isOnline: false,
        lastUpdate: null,
        errorMessage: null,
        consecutiveFailures: 0,
      });
    }
  }

  private applyResult(
    id: string,
    result: { power: number; energyToday: number } | null,
    error?: string,
  ) {
    const plant = this.plants.get(id);
    if (!plant) return;

    if (result) {
      plant.power = result.power;
      plant.energyToday = result.energyToday;
      plant.isOnline = true;
      plant.status = result.power > 0 ? 'online' : 'warning';
      plant.consecutiveFailures = 0;
      plant.errorMessage = null;
    } else {
      plant.consecutiveFailures++;
      plant.isOnline = false;
      plant.power = 0;
      plant.status = plant.consecutiveFailures >= 3 ? 'offline' : 'offline';
      plant.errorMessage = error ?? 'Aggiornamento fallito';
    }

    plant.lastUpdate = new Date().toISOString();
    this.plants.set(id, plant);
  }

  async updateAll() {
    const cfg = this.config.get();

    for (const plantCfg of cfg.aurora.plants) {
      const id = `aurora_${plantCfg.entityId}`;
      try {
        const result = await this.aurora.fetchPlantData(plantCfg.entityId);
        this.applyResult(id, result);
        this.logger.log(`${plantCfg.name}: ${result?.power?.toFixed(2)} kW`);
      } catch (e) {
        this.applyResult(id, null, e.message);
        this.logger.warn(`${plantCfg.name}: ${e.message}`);
      }
    }

    if (cfg.fusion.enabled) {
      try {
        const result = await this.fusion.fetchPlantData(cfg.fusion.plantId);
        this.applyResult('fusion_main', result);
        this.logger.log(`${cfg.fusion.plantName}: ${result?.power?.toFixed(2)} kW`);
      } catch (e) {
        this.applyResult('fusion_main', null, e.message);
        this.logger.warn(`${cfg.fusion.plantName}: ${e.message}`);
      }
    }
  }

  getAll(): PlantState[] {
    return Array.from(this.plants.values());
  }

  getOne(id: string): PlantState | undefined {
    return this.plants.get(id);
  }

  getStatus() {
    const plants = this.getAll();
    const totalPower = plants.reduce((sum, p) => sum + (p.isOnline ? p.power : 0), 0);
    return {
      totalPlants: plants.length,
      onlinePlants: plants.filter((p) => p.isOnline && p.power > 0).length,
      warningPlants: plants.filter((p) => p.isOnline && p.power === 0).length,
      offlinePlants: plants.filter((p) => !p.isOnline).length,
      totalPower: Math.round(totalPower * 100) / 100,
      updateInterval: this.config.updateInterval,
    };
  }
}

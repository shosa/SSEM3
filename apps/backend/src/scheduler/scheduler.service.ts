import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PlantsService } from '../plants/plants.service';
import { ConfigService } from '../config/config.service';

@Injectable()
export class SchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SchedulerService.name);
  private intervalHandle: NodeJS.Timeout;

  constructor(
    private readonly plants: PlantsService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    const interval = this.config.updateInterval * 1000;
    this.logger.log(`Scheduler avviato (intervallo: ${this.config.updateInterval}s)`);
    this.intervalHandle = setInterval(() => this.tick(), interval);
  }

  onModuleDestroy() {
    clearInterval(this.intervalHandle);
  }

  private async tick() {
    this.logger.log('Aggiornamento impianti...');
    await this.plants.updateAll();
  }
}

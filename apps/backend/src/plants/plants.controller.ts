import { Controller, Get, Param, Post, NotFoundException, Body, Put } from '@nestjs/common';
import { PlantsService } from './plants.service';
import { ConfigService, AppConfig } from '../config/config.service';

@Controller()
export class PlantsController {
  constructor(
    private readonly plants: PlantsService,
    private readonly config: ConfigService,
  ) {}

  @Get('plants')
  getAll() {
    return this.plants.getAll();
  }

  @Get('plants/:id')
  getOne(@Param('id') id: string) {
    const plant = this.plants.getOne(id);
    if (!plant) throw new NotFoundException('Impianto non trovato');
    return plant;
  }

  @Post('update')
  async forceUpdate() {
    await this.plants.updateAll();
    return { status: 'ok', plants: this.plants.getAll() };
  }

  @Get('status')
  getStatus() {
    return this.plants.getStatus();
  }

  @Get('config')
  getConfig() {
    return this.config.get();
  }

  @Put('config')
  saveConfig(@Body() body: AppConfig) {
    this.config.save(body);
    return { status: 'ok' };
  }
}

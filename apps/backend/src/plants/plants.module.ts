import { Module } from '@nestjs/common';
import { PlantsService } from './plants.service';
import { PlantsController } from './plants.controller';
import { AuroraModule } from '../providers/aurora/aurora.module';
import { FusionModule } from '../providers/fusion/fusion.module';

@Module({
  imports: [AuroraModule, FusionModule],
  providers: [PlantsService],
  controllers: [PlantsController],
  exports: [PlantsService],
})
export class PlantsModule {}

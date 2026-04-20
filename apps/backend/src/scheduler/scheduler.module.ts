import { Module } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';
import { PlantsModule } from '../plants/plants.module';

@Module({
  imports: [PlantsModule],
  providers: [SchedulerService],
})
export class SchedulerModule {}

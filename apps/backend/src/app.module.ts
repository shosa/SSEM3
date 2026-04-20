import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from './config/config.module';
import { PlantsModule } from './plants/plants.module';
import { SchedulerModule } from './scheduler/scheduler.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule,
    PlantsModule,
    SchedulerModule,
  ],
})
export class AppModule {}

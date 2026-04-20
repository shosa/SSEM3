import { Module } from '@nestjs/common';
import { LogBufferService } from './log-buffer.service';
import { LogsController } from './logs.controller';

@Module({
  providers: [LogBufferService],
  controllers: [LogsController],
  exports: [LogBufferService],
})
export class LogsModule {}

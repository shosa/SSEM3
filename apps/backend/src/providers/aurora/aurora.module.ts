import { Module } from '@nestjs/common';
import { AuroraProvider } from './aurora.provider';

@Module({
  providers: [AuroraProvider],
  exports: [AuroraProvider],
})
export class AuroraModule {}

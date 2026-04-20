import { Module } from '@nestjs/common';
import { FusionProvider } from './fusion.provider';

@Module({
  providers: [FusionProvider],
  exports: [FusionProvider],
})
export class FusionModule {}

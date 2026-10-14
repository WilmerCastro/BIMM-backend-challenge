import { Module } from '@nestjs/common';
import { NhtsaClient } from './infrastructure/nhtsa/nhtsa.client.js';

@Module({
  providers: [NhtsaClient],
})
export class IngestionModule {}

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggingModule } from './common/logging/logging.module.js';
import { validateEnv } from './config/env.js';
import { DatabaseModule } from './database/database.module.js';
import { IngestionModule } from './modules/ingestion/ingestion.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: [`.env.${process.env.NODE_ENV ?? 'development'}`, '.env'],
      validate: validateEnv,
    }),
    LoggingModule,
    DatabaseModule,
    IngestionModule,
  ],
})
export class AppModule {}

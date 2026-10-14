import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { CoreModule } from './core.module.js';
import { IngestionService } from './modules/ingestion/application/ingestion.service.js';
import { IngestionModule } from './modules/ingestion/ingestion.module.js';

@Module({ imports: [CoreModule, IngestionModule] })
class IngestCommandModule {}

const runIngestion = async () => {
  const app = await NestFactory.createApplicationContext(IngestCommandModule, {
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();

  try {
    const summary = await app.get(IngestionService).run();
    process.exitCode = summary?.status === 'FAILED' ? 1 : 0;
  } catch {
    process.exitCode = 1;
  } finally {
    await app.close();
  }
};

await runIngestion();

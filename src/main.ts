import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';
import { exitOnFatal, exitOnUnhandledErrors } from './common/logging/fatal.js';
import type { Env } from './config/env.js';

const bootstrap = async () => {
  const app = await NestFactory.create(AppModule, {
    logger: false,
    abortOnError: false,
  });
  const logger = app.get(Logger);
  app.useLogger(logger);
  app.enableShutdownHooks();

  const config = app.get<ConfigService<Env, true>>(ConfigService);
  const port = config.get('PORT', { infer: true });
  await app.listen(port);

  logger.log(
    { port, env: config.get('NODE_ENV', { infer: true }) },
    'Server started',
    'Bootstrap',
  );
};

exitOnUnhandledErrors();
await bootstrap().catch(exitOnFatal('Server failed to start'));

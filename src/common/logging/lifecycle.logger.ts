import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

@Injectable()
export class LifecycleLogger implements OnApplicationShutdown {
  constructor(private readonly logger: PinoLogger) {
    logger.setContext(LifecycleLogger.name);
  }

  onApplicationShutdown(signal?: string) {
    this.logger.info({ signal }, 'Application shut down');
  }
}

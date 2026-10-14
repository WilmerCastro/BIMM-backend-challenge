import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';

@Injectable()
export class LifecycleLogger implements OnApplicationShutdown {
  private readonly logger = new Logger(LifecycleLogger.name);

  onApplicationShutdown(signal?: string) {
    this.logger.log({ signal }, 'Application shut down');
  }
}

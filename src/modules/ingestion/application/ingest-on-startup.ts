import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../../config/env.js';
import {
  MAKE_REPOSITORY,
  type MakeReader,
} from '../../vehicles/domain/make.repository.js';
import { IngestionService } from './ingestion.service.js';

@Injectable()
export class IngestOnStartup implements OnApplicationBootstrap {
  private readonly logger = new Logger(IngestOnStartup.name);

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly ingestion: IngestionService,
    @Inject(MAKE_REPOSITORY) private readonly makes: MakeReader,
  ) {}

  async onApplicationBootstrap() {
    if (!this.config.get('INGEST_ON_STARTUP', { infer: true })) return;

    if ((await this.makes.countMakes()) > 0) {
      this.logger.log('Catalog already has data, skipping startup ingestion');
      return;
    }

    this.logger.log('Catalog is empty, starting ingestion in the background');
    void this.ingestion.run().catch(() => undefined);
  }
}

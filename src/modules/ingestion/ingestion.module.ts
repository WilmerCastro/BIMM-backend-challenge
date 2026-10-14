import { Module } from '@nestjs/common';
import { VehiclesModule } from '../vehicles/vehicles.module.js';
import { IngestionService } from './application/ingestion.service.js';
import { INGESTION_RUN_REPOSITORY } from './domain/ingestion-run.js';
import { INGESTION_LOCK } from './domain/ingestion.lock.js';
import { VEHICLE_CATALOG_SOURCE } from './domain/vehicle-catalog.source.js';
import { NhtsaClient } from './infrastructure/nhtsa/nhtsa.client.js';
import { PostgresIngestionLock } from './infrastructure/persistence/postgres-ingestion.lock.js';
import { TypeOrmIngestionRunRepository } from './infrastructure/persistence/typeorm-ingestion-run.repository.js';
import { IngestionResolver } from './presentation/graphql/ingestion.resolver.js';

@Module({
  imports: [VehiclesModule],
  providers: [
    IngestionService,
    { provide: VEHICLE_CATALOG_SOURCE, useClass: NhtsaClient },
    {
      provide: INGESTION_RUN_REPOSITORY,
      useClass: TypeOrmIngestionRunRepository,
    },
    { provide: INGESTION_LOCK, useClass: PostgresIngestionLock },
    IngestionResolver,
  ],
  exports: [IngestionService],
})
export class IngestionModule {}

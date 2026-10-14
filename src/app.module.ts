import { Module } from '@nestjs/common';
import { CoreModule } from './core.module.js';
import { GraphqlApiModule } from './graphql/graphql.module.js';
import { IngestOnStartup } from './modules/ingestion/application/ingest-on-startup.js';
import { IngestionModule } from './modules/ingestion/ingestion.module.js';
import { VehiclesModule } from './modules/vehicles/vehicles.module.js';

@Module({
  imports: [CoreModule, VehiclesModule, IngestionModule, GraphqlApiModule],
  providers: [IngestOnStartup],
})
export class AppModule {}

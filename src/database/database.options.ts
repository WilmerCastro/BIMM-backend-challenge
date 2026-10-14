import type { DataSourceOptions } from 'typeorm';
import type { Env } from '../config/env.js';
import { IngestionRunEntity } from '../modules/ingestion/infrastructure/persistence/ingestion-run.entity.js';
import { MakeVehicleTypeEntity } from '../modules/vehicles/infrastructure/persistence/make-vehicle-type.entity.js';
import { MakeEntity } from '../modules/vehicles/infrastructure/persistence/make.entity.js';
import { VehicleTypeEntity } from '../modules/vehicles/infrastructure/persistence/vehicle-type.entity.js';
import { CreateVehicleCatalog1791952000000 } from './migrations/1791952000000-create-vehicle-catalog.js';
import { CreateIngestionRuns1791953000000 } from './migrations/1791953000000-create-ingestion-runs.js';

export type EnvReader = <Key extends keyof Env>(key: Key) => Env[Key];

export const databaseOptions = (env: EnvReader): DataSourceOptions => ({
  type: 'postgres',
  host: env('DB_HOST'),
  port: env('DB_PORT'),
  username: env('DB_USER'),
  password: env('DB_PASSWORD'),
  database: env('DB_NAME'),
  entities: [
    MakeEntity,
    VehicleTypeEntity,
    MakeVehicleTypeEntity,
    IngestionRunEntity,
  ],
  migrations: [
    CreateVehicleCatalog1791952000000,
    CreateIngestionRuns1791953000000,
  ],
  migrationsRun: env('DB_RUN_MIGRATIONS'),
  synchronize: false,
});

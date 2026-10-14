import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import { validateEnv, type Env } from '../../src/config/env.js';
import { databaseOptions } from '../../src/database/database.options.js';

export type TestDatabase = {
  container: StartedPostgreSqlContainer;
  dataSource: DataSource;
  env: Env;
};

export const startTestDatabase = async (): Promise<TestDatabase> => {
  const container = await new PostgreSqlContainer('postgres:17-alpine').start();
  const env = validateEnv({
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    DB_HOST: container.getHost(),
    DB_PORT: String(container.getPort()),
    DB_USER: container.getUsername(),
    DB_PASSWORD: container.getPassword(),
    DB_NAME: container.getDatabase(),
  });
  const dataSource = await new DataSource(
    databaseOptions((key) => env[key]),
  ).initialize();
  return { container, dataSource, env };
};

export const stopTestDatabase = async (database?: TestDatabase) => {
  await database?.dataSource.destroy();
  await database?.container.stop();
};

export const clearTables = (dataSource: DataSource) =>
  dataSource.query(
    'TRUNCATE make_vehicle_types, makes, vehicle_types, ingestion_runs RESTART IDENTITY CASCADE',
  );

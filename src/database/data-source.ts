import { DataSource } from 'typeorm';
import { validateEnv } from '../config/env.js';
import { databaseOptions } from './database.options.js';

const env = validateEnv(process.env);

export default new DataSource({
  ...databaseOptions((key) => env[key]),
  migrationsRun: false,
});

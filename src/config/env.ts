import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
  DB_HOST: z.string().min(1).default('localhost'),
  DB_PORT: z.coerce.number().int().positive().default(5432),
  DB_USER: z.string().min(1).default('postgres'),
  DB_PASSWORD: z.string().min(1),
  DB_NAME: z.string().min(1).default('vehicles'),
  DB_RUN_MIGRATIONS: z.stringbool().default(true),
  NHTSA_BASE_URL: z
    .url()
    .default('https://vpic.nhtsa.dot.gov/api/vehicles')
    .transform((url) => url.replace(/\/+$/, '')),
  NHTSA_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
  NHTSA_MAX_RETRIES: z.coerce.number().int().min(0).max(10).default(3),
  NHTSA_RETRY_BASE_DELAY_MS: z.coerce.number().int().positive().default(500),
  NHTSA_CONCURRENCY: z.coerce.number().int().min(1).max(50).default(10),
  NHTSA_REQUESTS_PER_SECOND: z.coerce.number().positive().max(500).default(5),
  INGEST_ON_STARTUP: z.stringbool().default(false),
  INGEST_MAKES_LIMIT: z.coerce.number().int().positive().optional(),
  INGEST_BATCH_SIZE: z.coerce.number().int().positive().default(500),
});

export type Env = z.infer<typeof envSchema>;

export const validateEnv = (raw: Record<string, unknown>): Env => {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(
      `Invalid environment configuration:\n${z.prettifyError(result.error)}`,
    );
  }
  return result.data;
};

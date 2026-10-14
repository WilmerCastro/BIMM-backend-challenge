import { validateEnv } from './env.js';

describe('validateEnv', () => {
  it('fills in defaults when only the required values are set', () => {
    expect(validateEnv({ DB_PASSWORD: 'secret' })).toEqual({
      NODE_ENV: 'development',
      PORT: 3000,
      LOG_LEVEL: 'info',
      DB_HOST: 'localhost',
      DB_PORT: 5432,
      DB_USER: 'postgres',
      DB_PASSWORD: 'secret',
      DB_NAME: 'vehicles',
      NHTSA_BASE_URL: 'https://vpic.nhtsa.dot.gov/api/vehicles',
      NHTSA_TIMEOUT_MS: 10_000,
      NHTSA_MAX_RETRIES: 3,
      NHTSA_RETRY_BASE_DELAY_MS: 500,
      NHTSA_CONCURRENCY: 10,
    });
  });

  it('drops a trailing slash from the NHTSA base URL', () => {
    expect(
      validateEnv({
        DB_PASSWORD: 'secret',
        NHTSA_BASE_URL: 'https://example.test/api/',
      }).NHTSA_BASE_URL,
    ).toBe('https://example.test/api');
  });

  it('turns numeric strings from the environment into numbers', () => {
    expect(
      validateEnv({ DB_PASSWORD: 'secret', PORT: '8080', DB_PORT: '6543' }),
    ).toMatchObject({ PORT: 8080, DB_PORT: 6543 });
  });

  it('rejects a missing database password', () => {
    expect(() => validateEnv({})).toThrow(/DB_PASSWORD/);
  });

  it.each([
    ['PORT', 'abc'],
    ['NODE_ENV', 'staging'],
    ['LOG_LEVEL', 'verbose'],
    ['NHTSA_BASE_URL', 'not a url'],
    ['NHTSA_CONCURRENCY', '0'],
    ['NHTSA_CONCURRENCY', '500'],
  ])('rejects an invalid %s', (name, value) => {
    expect(() => validateEnv({ DB_PASSWORD: 'secret', [name]: value })).toThrow(
      new RegExp(name),
    );
  });
});

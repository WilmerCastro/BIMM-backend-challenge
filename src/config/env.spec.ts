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
    });
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
  ])('rejects an invalid %s', (name, value) => {
    expect(() => validateEnv({ DB_PASSWORD: 'secret', [name]: value })).toThrow(
      new RegExp(name),
    );
  });
});

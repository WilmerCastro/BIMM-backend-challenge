import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { delay, http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { validateEnv } from '../../../../config/env.js';
import {
  NetworkError,
  SourceBlockedError,
  XmlParseError,
} from '../../domain/ingestion.errors.js';
import { NhtsaClient } from './nhtsa.client.js';

const BASE_URL = 'https://nhtsa.test/api/vehicles';
const MAKES_URL = `${BASE_URL}/getallmakes`;
const TYPES_440_URL = `${BASE_URL}/GetVehicleTypesForMakeId/440`;

const fixture = (name: string) =>
  readFileSync(resolve('test/fixtures/nhtsa', name), 'utf8');

const createClient = (overrides: Record<string, string> = {}) =>
  new NhtsaClient(
    new ConfigService(
      validateEnv({
        DB_PASSWORD: 'unused',
        NHTSA_BASE_URL: BASE_URL,
        NHTSA_MAX_RETRIES: '2',
        NHTSA_RETRY_BASE_DELAY_MS: '1',
        NHTSA_REQUESTS_PER_SECOND: '500',
        ...overrides,
      }),
    ),
  );

const server = setupServer();

const countRequests = (url: string) => {
  let count = 0;
  server.events.on('request:start', ({ request }) => {
    if (request.url.startsWith(url)) count += 1;
  });
  return () => count;
};

beforeAll(() => {
  Logger.overrideLogger(false);
  server.listen({ onUnhandledFrame: 'error' });
});
afterEach(() => {
  server.resetHandlers();
  server.events.removeAllListeners();
});
afterAll(() => server.close());

describe('NhtsaClient', () => {
  it('fetches and parses all makes', async () => {
    server.use(http.get(MAKES_URL, () => HttpResponse.xml(fixture('getallmakes.xml'))));

    const makes = await createClient().getAllMakes();

    expect(makes).toContainEqual({ makeId: 11968, makeName: '818' });
    expect(makes).toHaveLength(4);
  });

  it('fetches and parses the vehicle types of a make', async () => {
    server.use(
      http.get(TYPES_440_URL, () => HttpResponse.xml(fixture('vehicle-types-440.xml'))),
    );

    await expect(createClient().getVehicleTypes(440)).resolves.toEqual([
      { typeId: 2, typeName: 'Passenger Car' },
      { typeId: 7, typeName: 'Multipurpose Passenger Vehicle (MPV)' },
    ]);
  });

  it('retries a server error and returns the later success', async () => {
    const requests = countRequests(TYPES_440_URL);
    server.use(
      http.get(TYPES_440_URL, () => new HttpResponse(null, { status: 503 }), {
        once: true,
      }),
      http.get(TYPES_440_URL, () => HttpResponse.xml(fixture('vehicle-types-440.xml'))),
    );

    await expect(createClient().getVehicleTypes(440)).resolves.toHaveLength(2);
    expect(requests()).toBe(2);
  });

  it('retries a dropped connection', async () => {
    const requests = countRequests(TYPES_440_URL);
    server.use(
      http.get(TYPES_440_URL, () => HttpResponse.error(), { once: true }),
      http.get(TYPES_440_URL, () => HttpResponse.xml(fixture('vehicle-types-440.xml'))),
    );

    await expect(createClient().getVehicleTypes(440)).resolves.toHaveLength(2);
    expect(requests()).toBe(2);
  });

  it('gives up after the configured retries', async () => {
    const requests = countRequests(TYPES_440_URL);
    server.use(http.get(TYPES_440_URL, () => new HttpResponse(null, { status: 500 })));

    await expect(createClient().getVehicleTypes(440)).rejects.toBeInstanceOf(
      NetworkError,
    );
    expect(requests()).toBe(3);
  });

  it('does not retry a client error', async () => {
    const requests = countRequests(TYPES_440_URL);
    server.use(
      http.get(TYPES_440_URL, () =>
        HttpResponse.json({ message: 'The request is invalid.' }, { status: 400 }),
      ),
    );

    await expect(createClient().getVehicleTypes(440)).rejects.toMatchObject({
      retryable: false,
      details: { status: 400 },
    });
    expect(requests()).toBe(1);
  });

  it('reports a 403 as blocked and does not retry it', async () => {
    const requests = countRequests(TYPES_440_URL);
    server.use(
      http.get(TYPES_440_URL, () =>
        HttpResponse.text('<H1>Access Denied</H1>', { status: 403 }),
      ),
    );

    await expect(createClient().getVehicleTypes(440)).rejects.toBeInstanceOf(
      SourceBlockedError,
    );
    expect(requests()).toBe(1);
  });

  it('times out a request that hangs', async () => {
    server.use(
      http.get(TYPES_440_URL, async () => {
        await delay('infinite');
        return HttpResponse.xml('');
      }),
    );

    await expect(
      createClient({ NHTSA_TIMEOUT_MS: '20', NHTSA_MAX_RETRIES: '0' }).getVehicleTypes(440),
    ).rejects.toBeInstanceOf(NetworkError);
  });

  it('does not retry a response that is not valid XML', async () => {
    const requests = countRequests(TYPES_440_URL);
    server.use(http.get(TYPES_440_URL, () => HttpResponse.text('<Response><Results>')));

    await expect(createClient().getVehicleTypes(440)).rejects.toBeInstanceOf(
      XmlParseError,
    );
    expect(requests()).toBe(1);
  });
});

import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { http, HttpResponse, passthrough } from 'msw';
import { setupServer } from 'msw/node';
import type { IngestionService } from '../../src/modules/ingestion/application/ingestion.service.js';
import {
  startTestDatabase,
  stopTestDatabase,
  type TestDatabase,
} from '../support/postgres.js';

const NHTSA = 'https://nhtsa.test/api/vehicles';
const FAILING_MAKE_ID = 11968;

const fixture = (name: string) =>
  readFileSync(resolve('test/fixtures/nhtsa', name), 'utf8');

const trailerXml = `<Response><Count>1</Count><Results><VehicleTypesForMakeIds><VehicleTypeId>6</VehicleTypeId><VehicleTypeName>Trailer</VehicleTypeName></VehicleTypesForMakeIds></Results></Response>`;

const nhtsa = setupServer(
  http.all(/^http:\/\/(127\.0\.0\.1|localhost|\[::1\])[:/]/, () =>
    passthrough(),
  ),
  http.get(`${NHTSA}/getallmakes`, () =>
    HttpResponse.xml(fixture('getallmakes.xml')),
  ),
  http.get(`${NHTSA}/GetVehicleTypesForMakeId/:makeId`, ({ params }) => {
    if (params.makeId === '440') {
      return HttpResponse.xml(fixture('vehicle-types-440.xml'));
    }
    if (params.makeId === String(FAILING_MAKE_ID)) {
      return new HttpResponse(null, { status: 503 });
    }
    return HttpResponse.xml(trailerXml);
  }),
);

let database: TestDatabase;
let app: INestApplication;
let graphqlUrl: string;

type GraphQLResponse = {
  data?: Record<string, unknown>;
  errors?: { message: string; extensions?: { code?: string } }[];
};

const graphql = async (query: string): Promise<GraphQLResponse> => {
  const response = await fetch(graphqlUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  return response.json() as Promise<GraphQLResponse>;
};

beforeAll(async () => {
  database = await startTestDatabase();
  Object.assign(process.env, {
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    DB_HOST: database.env.DB_HOST,
    DB_PORT: String(database.env.DB_PORT),
    DB_USER: database.env.DB_USER,
    DB_PASSWORD: database.env.DB_PASSWORD,
    DB_NAME: database.env.DB_NAME,
    NHTSA_BASE_URL: NHTSA,
    NHTSA_MAX_RETRIES: '1',
    NHTSA_RETRY_BASE_DELAY_MS: '1',
    NHTSA_REQUESTS_PER_SECOND: '500',
    INGEST_BATCH_SIZE: '2',
  });
  nhtsa.listen({ onUnhandledFrame: 'error' });

  const { AppModule } = await import('../../src/app.module.js');
  const { IngestionService } =
    await import('../../src/modules/ingestion/application/ingestion.service.js');
  app = await NestFactory.create(AppModule, { logger: false });
  await app.listen(0);
  graphqlUrl = `${await app.getUrl()}/graphql`;

  await app.get<IngestionService>(IngestionService).run();
});

afterAll(async () => {
  await app?.close();
  nhtsa.close();
  await stopTestDatabase(database);
});

describe('ingestion → Postgres → GraphQL', () => {
  it('reports the ingestion run, including the make that failed', async () => {
    const { data } = await graphql(
      '{ lastIngestion { status makesTotal makesSaved makesFailed failures { makeId reason } } }',
    );

    expect(data?.lastIngestion).toEqual({
      status: 'PARTIAL',
      makesTotal: 4,
      makesSaved: 3,
      makesFailed: 1,
      failures: [
        {
          makeId: FAILING_MAKE_ID,
          reason: expect.stringContaining('status 503'),
        },
      ],
    });
  });

  it('pages through the stored makes with their vehicle types', async () => {
    const page = (after?: string) =>
      graphql(
        `{ makes(first: 2${after ? `, after: "${after}"` : ''}) {
             totalCount
             nodes { makeId makeName vehicleTypes { typeName } }
             pageInfo { hasNextPage endCursor }
           } }`,
      );

    const first = (await page()).data?.makes as {
      totalCount: number;
      nodes: { makeName: string }[];
      pageInfo: { hasNextPage: boolean; endCursor: string };
    };
    const second = (await page(first.pageInfo.endCursor)).data?.makes as {
      nodes: { makeName: string }[];
      pageInfo: { hasNextPage: boolean };
    };

    expect(first.totalCount).toBe(3);
    expect(first.pageInfo.hasNextPage).toBe(true);
    expect(second.pageInfo.hasNextPage).toBe(false);
    expect(
      [...first.nodes, ...second.nodes].map((make) => make.makeName).sort(),
    ).toEqual(['4M FARM & TRAILER SALES', 'ALL CUSTOM', 'ASTON MARTIN']);
  });

  it('filters by name and by vehicle type', async () => {
    const { data } = await graphql(`
      {
        byName: makes(name: "farm") {
          nodes {
            makeName
          }
        }
        byType: makes(vehicleTypeId: 2) {
          nodes {
            makeName
          }
        }
      }
    `);

    expect(data).toEqual({
      byName: { nodes: [{ makeName: '4M FARM & TRAILER SALES' }] },
      byType: { nodes: [{ makeName: 'ASTON MARTIN' }] },
    });
  });

  it('finds one make and returns null for a make that was not stored', async () => {
    const { data } = await graphql(`{
      found: make(makeId: 440) { makeName vehicleTypes { typeId } }
      failed: make(makeId: ${FAILING_MAKE_ID}) { makeName }
    }`);

    expect(data).toEqual({
      found: {
        makeName: 'ASTON MARTIN',
        vehicleTypes: [{ typeId: 2 }, { typeId: 7 }],
      },
      failed: null,
    });
  });

  it('lists every vehicle type', async () => {
    const { data } = await graphql('{ vehicleTypes { typeId } }');

    expect(data?.vehicleTypes).toEqual([
      { typeId: 2 },
      { typeId: 6 },
      { typeId: 7 },
    ]);
  });

  it('rejects an invalid page size as a client error', async () => {
    const { errors } = await graphql('{ makes(first: 0) { totalCount } }');

    expect(errors?.[0].extensions?.code).toBe('BAD_USER_INPUT');
  });

  it('reports itself healthy', async () => {
    const response = await fetch(graphqlUrl.replace('/graphql', '/health'));

    expect(await response.json()).toEqual({ status: 'ok' });
  });
});

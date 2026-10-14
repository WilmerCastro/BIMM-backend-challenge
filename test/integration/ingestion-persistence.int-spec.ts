import { PostgresIngestionLock } from '../../src/modules/ingestion/infrastructure/persistence/postgres-ingestion.lock.js';
import { TypeOrmIngestionRunRepository } from '../../src/modules/ingestion/infrastructure/persistence/typeorm-ingestion-run.repository.js';
import {
  clearTables,
  startTestDatabase,
  stopTestDatabase,
  type TestDatabase,
} from '../support/postgres.js';

let database: TestDatabase;

beforeAll(async () => {
  database = await startTestDatabase();
});

afterEach(() => clearTables(database.dataSource));

afterAll(() => stopTestDatabase(database));

describe('TypeOrmIngestionRunRepository', () => {
  it('records a run from start to finish', async () => {
    const runs = new TypeOrmIngestionRunRepository(database.dataSource);

    const runId = await runs.start();
    expect(await runs.findLatest()).toMatchObject({
      id: runId,
      status: 'RUNNING',
      finishedAt: null,
    });

    const failures = [{ makeId: 2, makeName: 'TWO', reason: 'NetworkError: boom' }];
    await runs.finish(runId, {
      status: 'PARTIAL',
      makesTotal: 3,
      makesSaved: 2,
      makesFailed: 1,
      failures,
      error: null,
    });

    expect(await runs.findLatest()).toMatchObject({
      status: 'PARTIAL',
      makesSaved: 2,
      failures,
      finishedAt: expect.any(Date),
    });
  });

  it('returns the most recent run', async () => {
    const runs = new TypeOrmIngestionRunRepository(database.dataSource);
    await runs.start();
    const latestId = await runs.start();

    expect((await runs.findLatest())?.id).toBe(latestId);
  });
});

describe('PostgresIngestionLock', () => {
  it('lets only one task run at a time', async () => {
    const first = new PostgresIngestionLock(database.dataSource);
    const second = new PostgresIngestionLock(database.dataSource);
    let release!: () => void;
    const holding = new Promise<void>((resolve) => {
      release = resolve;
    });

    const firstRun = first.runExclusively(() => holding.then(() => 'first'));
    await new Promise((resolve) => setTimeout(resolve, 100));

    await expect(second.runExclusively(async () => 'second')).resolves.toEqual({
      acquired: false,
    });

    release();
    await expect(firstRun).resolves.toEqual({ acquired: true, result: 'first' });
    await expect(second.runExclusively(async () => 'second')).resolves.toEqual({
      acquired: true,
      result: 'second',
    });
  });

  it('releases the lock when the task fails', async () => {
    const lock = new PostgresIngestionLock(database.dataSource);

    await expect(
      lock.runExclusively(async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    await expect(lock.runExclusively(async () => 'again')).resolves.toEqual({
      acquired: true,
      result: 'again',
    });
  });
});

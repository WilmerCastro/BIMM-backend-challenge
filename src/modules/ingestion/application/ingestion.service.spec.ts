import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { validateEnv, type Env } from '../../../config/env.js';
import type { Make, MakeSummary, VehicleType } from '../../vehicles/domain/make.js';
import type { MakeWriter } from '../../vehicles/domain/make.repository.js';
import type {
  IngestionOutcome,
  IngestionRun,
  IngestionRunRepository,
} from '../domain/ingestion-run.js';
import type { IngestionLock, LockOutcome } from '../domain/ingestion.lock.js';
import {
  NetworkError,
  SourceBlockedError,
} from '../domain/ingestion.errors.js';
import type { VehicleCatalogSource } from '../domain/vehicle-catalog.source.js';
import { IngestionService } from './ingestion.service.js';

const trailer = { typeId: 6, typeName: 'Trailer' };

const makes: MakeSummary[] = [
  { makeId: 1, makeName: 'ONE' },
  { makeId: 2, makeName: 'TWO' },
  { makeId: 3, makeName: 'THREE' },
];

class FakeSource implements VehicleCatalogSource {
  failingMakeIds = new Set<number>();
  blockedMakeIds = new Set<number>();
  allMakesError?: Error;

  getAllMakes = vi.fn(async () => {
    if (this.allMakesError) throw this.allMakesError;
    return makes;
  });

  getVehicleTypes = vi.fn(async (makeId: number): Promise<VehicleType[]> => {
    if (this.blockedMakeIds.has(makeId)) {
      throw new SourceBlockedError(`make ${makeId} was blocked`);
    }
    if (this.failingMakeIds.has(makeId)) {
      throw new NetworkError(`make ${makeId} failed`, true);
    }
    return [trailer];
  });
}

class InMemoryMakes implements MakeWriter {
  saved: Make[] = [];
  failOnCall?: number;
  private calls = 0;

  async saveMakes(batch: readonly Make[]) {
    this.calls += 1;
    if (this.calls === this.failOnCall) throw new Error('database is down');
    this.saved.push(...batch);
  }
}

class InMemoryRuns implements IngestionRunRepository {
  outcomes: IngestionOutcome[] = [];

  async start() {
    return 1;
  }

  async finish(_runId: number, outcome: IngestionOutcome) {
    this.outcomes.push(outcome);
  }

  async findLatest(): Promise<IngestionRun | null> {
    return null;
  }
}

class FakeLock implements IngestionLock {
  busy = false;

  async runExclusively<Result>(
    task: () => Promise<Result>,
  ): Promise<LockOutcome<Result>> {
    if (this.busy) return { acquired: false };
    return { acquired: true, result: await task() };
  }
}

const setup = (env: Record<string, string> = {}) => {
  const source = new FakeSource();
  const repository = new InMemoryMakes();
  const runs = new InMemoryRuns();
  const lock = new FakeLock();
  const config = new ConfigService<Env, true>(
    validateEnv({ DB_PASSWORD: 'unused', INGEST_BATCH_SIZE: '2', ...env }),
  );
  const service = new IngestionService(source, repository, runs, lock, config);
  return { service, source, repository, runs, lock };
};

beforeAll(() => Logger.overrideLogger(false));

describe('IngestionService', () => {
  it('saves every make with its vehicle types and records a completed run', async () => {
    const { service, repository, runs } = setup();

    const summary = await service.run();

    expect(repository.saved.map((make) => make.makeId)).toEqual([1, 2, 3]);
    expect(repository.saved[0].vehicleTypes).toEqual([trailer]);
    expect(summary).toMatchObject({ status: 'COMPLETED', makesSaved: 3 });
    expect(runs.outcomes).toEqual([
      expect.objectContaining({ status: 'COMPLETED', makesTotal: 3 }),
    ]);
  });

  it('keeps going when some makes fail and records which ones', async () => {
    const { service, source, repository } = setup();
    source.failingMakeIds.add(2);

    const summary = await service.run();

    expect(repository.saved.map((make) => make.makeId)).toEqual([1, 3]);
    expect(summary).toMatchObject({
      status: 'PARTIAL',
      makesSaved: 2,
      makesFailed: 1,
      failures: [
        { makeId: 2, makeName: 'TWO', reason: 'NetworkError: make 2 failed' },
      ],
    });
  });

  it('counts a batch that cannot be saved as failed and saves the next one', async () => {
    const { service, repository } = setup();
    repository.failOnCall = 1;

    const summary = await service.run();

    expect(repository.saved.map((make) => make.makeId)).toEqual([3]);
    expect(summary).toMatchObject({ status: 'PARTIAL', makesFailed: 2 });
    expect(summary?.failures[0].reason).toMatch(/^PersistenceError/);
  });

  it('stops after the batch where NHTSA starts blocking requests', async () => {
    const { service, source, repository } = setup();
    source.blockedMakeIds.add(1);

    const summary = await service.run();

    expect(repository.saved.map((make) => make.makeId)).toEqual([2]);
    expect(source.getVehicleTypes).not.toHaveBeenCalledWith(3);
    expect(summary).toMatchObject({
      status: 'PARTIAL',
      makesTotal: 3,
      makesFailed: 1,
      error: 'Stopped early because NHTSA blocked requests (403)',
    });
  });

  it('marks the run as failed when nothing could be saved', async () => {
    const { service, source } = setup();
    makes.forEach((make) => source.failingMakeIds.add(make.makeId));

    await expect(service.run()).resolves.toMatchObject({ status: 'FAILED' });
  });

  it('records a failed run and rethrows when the makes list cannot be fetched', async () => {
    const { service, source, runs } = setup();
    source.allMakesError = new NetworkError('getallmakes is down', true);

    await expect(service.run()).rejects.toThrow('getallmakes is down');
    expect(runs.outcomes).toEqual([
      expect.objectContaining({
        status: 'FAILED',
        error: 'NetworkError: getallmakes is down',
      }),
    ]);
  });

  it('only ingests the first makes when a limit is set', async () => {
    const { service, repository } = setup({ INGEST_MAKES_LIMIT: '2' });

    await service.run();

    expect(repository.saved.map((make) => make.makeId)).toEqual([1, 2]);
  });

  it('skips the run when another ingestion holds the lock', async () => {
    const { service, source, lock } = setup();
    lock.busy = true;

    await expect(service.run()).resolves.toBeNull();
    expect(source.getAllMakes).not.toHaveBeenCalled();
  });
});

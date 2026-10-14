import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { chunk } from '../../../common/collections/chunk.js';
import { mapSettledWithConcurrency } from '../../../common/resilience/map-settled.js';
import type { Env } from '../../../config/env.js';
import type { MakeSummary, VehicleType } from '../../vehicles/domain/make.js';
import {
  MAKE_REPOSITORY,
  type MakeWriter,
} from '../../vehicles/domain/make.repository.js';
import { combineMakesWithVehicleTypes } from '../domain/combine-makes.js';
import {
  INGESTION_RUN_REPOSITORY,
  type IngestionFailure,
  type IngestionOutcome,
  type IngestionRunRepository,
  type IngestionStatus,
} from '../domain/ingestion-run.js';
import {
  PersistenceError,
  SourceBlockedError,
} from '../domain/ingestion.errors.js';
import {
  INGESTION_LOCK,
  type IngestionLock,
} from '../domain/ingestion.lock.js';
import {
  VEHICLE_CATALOG_SOURCE,
  type VehicleCatalogSource,
} from '../domain/vehicle-catalog.source.js';

export type IngestionSummary = IngestionOutcome & {
  runId: number;
  durationMs: number;
};

type BatchResult = {
  saved: number;
  failures: IngestionFailure[];
  blocked: boolean;
};

const MAX_STORED_FAILURES = 100;

const describeError = (error: unknown) =>
  error instanceof Error ? `${error.name}: ${error.message}` : String(error);

const toFailure = (make: MakeSummary, error: unknown): IngestionFailure => ({
  makeId: make.makeId,
  makeName: make.makeName,
  reason: describeError(error),
});

const statusFor = (saved: number, failed: number): IngestionStatus => {
  if (failed === 0) return 'COMPLETED';
  return saved > 0 ? 'PARTIAL' : 'FAILED';
};

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);

  constructor(
    @Inject(VEHICLE_CATALOG_SOURCE)
    private readonly source: VehicleCatalogSource,
    @Inject(MAKE_REPOSITORY) private readonly makes: MakeWriter,
    @Inject(INGESTION_RUN_REPOSITORY)
    private readonly runs: IngestionRunRepository,
    @Inject(INGESTION_LOCK) private readonly lock: IngestionLock,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async run(): Promise<IngestionSummary | null> {
    const outcome = await this.lock.runExclusively(() => this.ingest());
    if (!outcome.acquired) {
      this.logger.warn('Another ingestion is already running, skipping');
      return null;
    }
    return outcome.result;
  }

  private async ingest(): Promise<IngestionSummary> {
    const startedAt = Date.now();
    const runId = await this.runs.start();
    this.logger.log({ runId }, 'Ingestion started');

    try {
      const makes = this.applyLimit(await this.source.getAllMakes());
      const batches = chunk(
        makes,
        this.config.get('INGEST_BATCH_SIZE', { infer: true }),
      );
      await this.runs.updateProgress(runId, {
        makesTotal: makes.length,
        makesSaved: 0,
        makesFailed: 0,
      });

      let saved = 0;
      let stoppedEarly = false;
      const failures: IngestionFailure[] = [];
      for (const [index, batch] of batches.entries()) {
        const result = await this.ingestBatch(batch);
        saved += result.saved;
        failures.push(...result.failures);
        await this.runs.updateProgress(runId, {
          makesTotal: makes.length,
          makesSaved: saved,
          makesFailed: failures.length,
        });
        this.logger.log(
          {
            runId,
            batch: index + 1,
            batches: batches.length,
            saved,
            failed: failures.length,
          },
          'Ingestion progress',
        );
        if (result.blocked) {
          stoppedEarly = true;
          this.logger.warn(
            { runId, batchesLeft: batches.length - index - 1 },
            'NHTSA is blocking requests, stopping early',
          );
          break;
        }
      }

      const outcome: IngestionOutcome = {
        status: statusFor(saved, failures.length),
        makesTotal: makes.length,
        makesSaved: saved,
        makesFailed: failures.length,
        failures: failures.slice(0, MAX_STORED_FAILURES),
        error: stoppedEarly
          ? 'Stopped early because NHTSA blocked requests (403)'
          : null,
      };
      await this.runs.finish(runId, outcome);
      const durationMs = Date.now() - startedAt;
      this.logger.log(
        {
          runId,
          status: outcome.status,
          makesTotal: outcome.makesTotal,
          makesSaved: outcome.makesSaved,
          makesFailed: outcome.makesFailed,
          durationMs,
        },
        'Ingestion finished',
      );
      return { ...outcome, runId, durationMs };
    } catch (error) {
      await this.runs.finish(runId, {
        status: 'FAILED',
        makesTotal: 0,
        makesSaved: 0,
        makesFailed: 0,
        failures: [],
        error: describeError(error),
      });
      this.logger.error({ runId, err: error }, 'Ingestion failed');
      throw error;
    }
  }

  private applyLimit(makes: MakeSummary[]) {
    const limit = this.config.get('INGEST_MAKES_LIMIT', { infer: true });
    return limit === undefined ? makes : makes.slice(0, limit);
  }

  private async ingestBatch(batch: MakeSummary[]): Promise<BatchResult> {
    const results = await mapSettledWithConcurrency(
      batch,
      this.config.get('NHTSA_CONCURRENCY', { infer: true }),
      (make) => this.source.getVehicleTypes(make.makeId),
    );

    const vehicleTypesByMakeId = new Map<number, VehicleType[]>();
    const failures: IngestionFailure[] = [];
    results.forEach((result, index) => {
      const make = batch[index];
      if (result.status === 'fulfilled') {
        vehicleTypesByMakeId.set(make.makeId, result.value);
        return;
      }
      failures.push(toFailure(make, result.reason));
      this.logger.warn(
        { makeId: make.makeId, err: result.reason },
        'Could not fetch vehicle types for make',
      );
    });

    const blocked = results.some(
      (result) =>
        result.status === 'rejected' &&
        result.reason instanceof SourceBlockedError,
    );
    const makes = combineMakesWithVehicleTypes(batch, vehicleTypesByMakeId);
    try {
      await this.makes.saveMakes(makes);
      return { saved: makes.length, failures, blocked };
    } catch (cause) {
      const error = new PersistenceError('Could not save a batch of makes', {
        makeIds: makes.map((make) => make.makeId),
        cause: describeError(cause),
      });
      this.logger.error(
        { err: error, makes: makes.length },
        'Could not save batch',
      );
      return {
        saved: 0,
        failures: [...failures, ...makes.map((make) => toFailure(make, error))],
        blocked,
      };
    }
  }
}

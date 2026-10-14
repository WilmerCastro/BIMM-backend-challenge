export type IngestionStatus = 'RUNNING' | 'COMPLETED' | 'PARTIAL' | 'FAILED';

export type IngestionFailure = {
  makeId: number;
  makeName: string;
  reason: string;
};

export type IngestionRun = {
  id: number;
  status: IngestionStatus;
  startedAt: Date;
  finishedAt: Date | null;
  makesTotal: number;
  makesSaved: number;
  makesFailed: number;
  failures: IngestionFailure[];
  error: string | null;
};

export type IngestionOutcome = Pick<
  IngestionRun,
  'status' | 'makesTotal' | 'makesSaved' | 'makesFailed' | 'failures' | 'error'
>;

export const INGESTION_RUN_REPOSITORY = Symbol('IngestionRunRepository');

export interface IngestionRunRepository {
  start(): Promise<number>;
  finish(runId: number, outcome: IngestionOutcome): Promise<void>;
  findLatest(): Promise<IngestionRun | null>;
}

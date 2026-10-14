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

export type IngestionProgress = Pick<
  IngestionRun,
  'makesTotal' | 'makesSaved' | 'makesFailed'
>;

export const INGESTION_RUN_REPOSITORY = Symbol('IngestionRunRepository');

export interface IngestionRunRepository {
  start(): Promise<number>;
  updateProgress(runId: number, progress: IngestionProgress): Promise<void>;
  finish(runId: number, outcome: IngestionOutcome): Promise<void>;
  findLatest(): Promise<IngestionRun | null>;
}

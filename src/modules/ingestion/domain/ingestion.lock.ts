export type LockOutcome<Result> =
  { acquired: true; result: Result } | { acquired: false };

export const INGESTION_LOCK = Symbol('IngestionLock');

export interface IngestionLock {
  runExclusively<Result>(
    task: () => Promise<Result>,
  ): Promise<LockOutcome<Result>>;
}

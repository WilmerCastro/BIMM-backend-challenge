import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type {
  IngestionLock,
  LockOutcome,
} from '../../domain/ingestion.lock.js';

const INGESTION_LOCK_KEY = 4_401_212;

@Injectable()
export class PostgresIngestionLock implements IngestionLock {
  constructor(private readonly dataSource: DataSource) {}

  async runExclusively<Result>(
    task: () => Promise<Result>,
  ): Promise<LockOutcome<Result>> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    try {
      const [{ locked }]: { locked: boolean }[] = await queryRunner.query(
        'SELECT pg_try_advisory_lock($1) AS locked',
        [INGESTION_LOCK_KEY],
      );
      if (!locked) return { acquired: false };

      try {
        return { acquired: true, result: await task() };
      } finally {
        await queryRunner.query('SELECT pg_advisory_unlock($1)', [
          INGESTION_LOCK_KEY,
        ]);
      }
    } finally {
      await queryRunner.release();
    }
  }
}

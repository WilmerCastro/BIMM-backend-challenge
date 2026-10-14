import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateIngestionRuns1791953000000 implements MigrationInterface {
  name = 'CreateIngestionRuns1791953000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE ingestion_runs (
        id serial PRIMARY KEY,
        status text NOT NULL
          CHECK (status IN ('RUNNING', 'COMPLETED', 'PARTIAL', 'FAILED')),
        started_at timestamptz NOT NULL,
        finished_at timestamptz,
        makes_total integer NOT NULL DEFAULT 0,
        makes_saved integer NOT NULL DEFAULT 0,
        makes_failed integer NOT NULL DEFAULT 0,
        failures jsonb NOT NULL DEFAULT '[]',
        error text
      )
    `);
    await queryRunner.query(
      'CREATE INDEX ingestion_runs_started_at_idx ON ingestion_runs (started_at DESC)',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE ingestion_runs');
  }
}

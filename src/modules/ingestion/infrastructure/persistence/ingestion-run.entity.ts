import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import type {
  IngestionFailure,
  IngestionStatus,
} from '../../domain/ingestion-run.js';

@Entity('ingestion_runs')
export class IngestionRunEntity {
  @PrimaryGeneratedColumn({ name: 'id' })
  id: number;

  @Column({ name: 'status', type: 'text' })
  status: IngestionStatus;

  @Column({ name: 'started_at', type: 'timestamptz' })
  startedAt: Date;

  @Column({ name: 'finished_at', type: 'timestamptz', nullable: true })
  finishedAt: Date | null;

  @Column({ name: 'makes_total', type: 'integer', default: 0 })
  makesTotal: number;

  @Column({ name: 'makes_saved', type: 'integer', default: 0 })
  makesSaved: number;

  @Column({ name: 'makes_failed', type: 'integer', default: 0 })
  makesFailed: number;

  @Column({ name: 'failures', type: 'jsonb', default: () => "'[]'" })
  failures: IngestionFailure[];

  @Column({ name: 'error', type: 'text', nullable: true })
  error: string | null;
}

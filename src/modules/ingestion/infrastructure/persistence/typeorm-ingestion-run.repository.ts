import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type {
  IngestionOutcome,
  IngestionProgress,
  IngestionRun,
  IngestionRunRepository,
} from '../../domain/ingestion-run.js';
import { IngestionRunEntity } from './ingestion-run.entity.js';

@Injectable()
export class TypeOrmIngestionRunRepository implements IngestionRunRepository {
  constructor(private readonly dataSource: DataSource) {}

  private get runs() {
    return this.dataSource.getRepository(IngestionRunEntity);
  }

  async start(): Promise<number> {
    const run = await this.runs.save({
      status: 'RUNNING',
      startedAt: new Date(),
    });
    return run.id;
  }

  async updateProgress(
    runId: number,
    progress: IngestionProgress,
  ): Promise<void> {
    await this.runs.update(runId, progress);
  }

  async finish(runId: number, outcome: IngestionOutcome): Promise<void> {
    await this.runs.update(runId, { ...outcome, finishedAt: new Date() });
  }

  async findLatest(): Promise<IngestionRun | null> {
    const [latest] = await this.runs.find({
      order: { startedAt: 'DESC', id: 'DESC' },
      take: 1,
    });
    return latest ?? null;
  }
}

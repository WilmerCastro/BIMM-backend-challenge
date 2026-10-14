import { Inject } from '@nestjs/common';
import { Query, Resolver } from '@nestjs/graphql';
import {
  INGESTION_RUN_REPOSITORY,
  type IngestionRunRepository,
} from '../../domain/ingestion-run.js';
import { IngestionRunObject } from './ingestion-run.object.js';

@Resolver(() => IngestionRunObject)
export class IngestionResolver {
  constructor(
    @Inject(INGESTION_RUN_REPOSITORY)
    private readonly runs: IngestionRunRepository,
  ) {}

  @Query(() => IngestionRunObject, {
    nullable: true,
    description: 'The most recent ingestion run, or null before the first one.',
  })
  lastIngestion() {
    return this.runs.findLatest();
  }
}

import { Field, Int, ObjectType, registerEnumType } from '@nestjs/graphql';
import type { IngestionStatus } from '../../domain/ingestion-run.js';

export const IngestionStatusValues = {
  RUNNING: 'RUNNING',
  COMPLETED: 'COMPLETED',
  PARTIAL: 'PARTIAL',
  FAILED: 'FAILED',
} as const satisfies Record<IngestionStatus, IngestionStatus>;

registerEnumType(IngestionStatusValues, {
  name: 'IngestionStatus',
  description: 'Outcome of an ingestion run.',
  valuesMap: {
    RUNNING: { description: 'Still fetching and saving makes.' },
    COMPLETED: { description: 'Every make was saved.' },
    PARTIAL: { description: 'Some makes were saved and some failed.' },
    FAILED: { description: 'Nothing could be saved.' },
  },
});

@ObjectType('IngestionFailure', {
  description: 'A make that could not be ingested.',
})
export class IngestionFailureObject {
  @Field(() => Int)
  makeId: number;

  @Field()
  makeName: string;

  @Field({ description: 'Error type and message.' })
  reason: string;
}

@ObjectType('IngestionRun', {
  description: 'One execution of the NHTSA ingestion pipeline.',
})
export class IngestionRunObject {
  @Field(() => Int)
  id: number;

  @Field(() => IngestionStatusValues)
  status: IngestionStatus;

  @Field()
  startedAt: Date;

  @Field(() => Date, { nullable: true })
  finishedAt: Date | null;

  @Field(() => Int)
  makesTotal: number;

  @Field(() => Int)
  makesSaved: number;

  @Field(() => Int)
  makesFailed: number;

  @Field(() => [IngestionFailureObject], {
    description: 'Up to 100 makes that failed, for troubleshooting.',
  })
  failures: IngestionFailureObject[];

  @Field(() => String, {
    nullable: true,
    description: 'Why the whole run failed, when it did.',
  })
  error: string | null;
}

import { ArgsType, Field, Int } from '@nestjs/graphql';
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
} from '../../application/vehicle-catalog.service.js';

@ArgsType()
export class MakesArgs {
  @Field(() => Int, {
    defaultValue: DEFAULT_PAGE_SIZE,
    description: `How many makes to return, from 1 to ${MAX_PAGE_SIZE}.`,
  })
  first: number;

  @Field(() => String, {
    nullable: true,
    description: 'The endCursor of the previous page.',
  })
  after?: string | null;

  @Field(() => String, {
    nullable: true,
    description: 'Case-insensitive part of the make name.',
  })
  name?: string | null;

  @Field(() => Int, {
    nullable: true,
    description: 'Only makes that build this vehicle type.',
  })
  vehicleTypeId?: number | null;
}

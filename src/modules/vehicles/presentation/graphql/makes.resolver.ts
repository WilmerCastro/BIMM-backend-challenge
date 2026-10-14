import {
  Args,
  Context,
  Int,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import type { GraphQLContext } from '../../../../graphql/graphql.context.js';
import { VehicleCatalogService } from '../../application/vehicle-catalog.service.js';
import { MakeConnectionObject, MakeObject } from './make.object.js';
import { MakesArgs } from './makes.args.js';
import { VehicleTypeObject } from './vehicle-type.object.js';

@Resolver(() => MakeObject)
export class MakesResolver {
  constructor(private readonly catalog: VehicleCatalogService) {}

  @Query(() => MakeConnectionObject, {
    description: 'Makes ordered by name, paginated with cursors.',
  })
  makes(@Args() args: MakesArgs) {
    return this.catalog.listMakes({
      first: args.first,
      after: args.after ?? undefined,
      name: args.name ?? undefined,
      vehicleTypeId: args.vehicleTypeId ?? undefined,
    });
  }

  @Query(() => MakeObject, {
    nullable: true,
    description: 'One make, or null when the id is unknown.',
  })
  make(@Args('makeId', { type: () => Int }) makeId: number) {
    return this.catalog.findMake(makeId);
  }

  @Query(() => [VehicleTypeObject], {
    name: 'vehicleTypes',
    description: 'Every vehicle type in the catalog.',
  })
  allVehicleTypes() {
    return this.catalog.listVehicleTypes();
  }

  @ResolveField(() => [VehicleTypeObject], {
    description: 'Vehicle types this make builds.',
  })
  vehicleTypes(@Parent() make: MakeObject, @Context() context: GraphQLContext) {
    return context.vehicleTypesLoader.load(make.makeId);
  }
}

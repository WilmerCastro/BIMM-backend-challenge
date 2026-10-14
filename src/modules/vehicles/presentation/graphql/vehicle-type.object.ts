import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType('VehicleType', {
  description: 'A kind of vehicle, as classified by NHTSA.',
})
export class VehicleTypeObject {
  @Field(() => Int, { description: 'NHTSA vehicle type id.' })
  typeId: number;

  @Field({ description: 'Vehicle type name, e.g. "Passenger Car".' })
  typeName: string;
}

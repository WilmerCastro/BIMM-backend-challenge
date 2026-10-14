import type {
  Make,
  MakeSummary,
  VehicleType,
} from '../../vehicles/domain/make.js';

const uniqueByTypeId = (vehicleTypes: readonly VehicleType[]) =>
  [...new Map(vehicleTypes.map((type) => [type.typeId, type])).values()].sort(
    (a, b) => a.typeId - b.typeId,
  );

export const combineMakesWithVehicleTypes = (
  makes: readonly MakeSummary[],
  vehicleTypesByMakeId: ReadonlyMap<number, readonly VehicleType[]>,
): Make[] => {
  const uniqueMakes = new Map(makes.map((make) => [make.makeId, make]));

  return [...uniqueMakes.values()].flatMap((make) => {
    const vehicleTypes = vehicleTypesByMakeId.get(make.makeId);
    return vehicleTypes
      ? [{ ...make, vehicleTypes: uniqueByTypeId(vehicleTypes) }]
      : [];
  });
};

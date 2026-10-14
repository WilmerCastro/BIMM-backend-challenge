import type { VehicleCatalogService } from '../../application/vehicle-catalog.service.js';
import { VehicleTypesLoaderFactory } from './vehicle-types.loader.js';

const car = { typeId: 2, typeName: 'Passenger Car' };

const createLoader = () => {
  const vehicleTypesForMakes = vi.fn(
    async (makeIds: readonly number[]) =>
      new Map(makeIds.filter((id) => id !== 3).map((id) => [id, [car]])),
  );
  const catalog = { vehicleTypesForMakes } as unknown as VehicleCatalogService;
  return { loader: new VehicleTypesLoaderFactory(catalog).create(), vehicleTypesForMakes };
};

describe('VehicleTypesLoaderFactory', () => {
  it('loads the vehicle types of many makes with a single query', async () => {
    const { loader, vehicleTypesForMakes } = createLoader();

    const results = await Promise.all([1, 2, 3].map((id) => loader.load(id)));

    expect(vehicleTypesForMakes).toHaveBeenCalledTimes(1);
    expect(vehicleTypesForMakes).toHaveBeenCalledWith([1, 2, 3]);
    expect(results).toEqual([[car], [car], []]);
  });
});

import { Injectable } from '@nestjs/common';
import DataLoader from 'dataloader';
import { VehicleCatalogService } from '../../application/vehicle-catalog.service.js';
import type { VehicleType } from '../../domain/make.js';

export type VehicleTypesLoader = DataLoader<number, VehicleType[]>;

@Injectable()
export class VehicleTypesLoaderFactory {
  constructor(private readonly catalog: VehicleCatalogService) {}

  create(): VehicleTypesLoader {
    return new DataLoader(async (makeIds) => {
      const vehicleTypesByMakeId =
        await this.catalog.vehicleTypesForMakes(makeIds);
      return makeIds.map((makeId) => vehicleTypesByMakeId.get(makeId) ?? []);
    });
  }
}

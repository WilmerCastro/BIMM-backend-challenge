import type { MakeSummary, VehicleType } from '../../vehicles/domain/make.js';

export const VEHICLE_CATALOG_SOURCE = Symbol('VehicleCatalogSource');

export interface VehicleCatalogSource {
  getAllMakes(): Promise<MakeSummary[]>;
  getVehicleTypes(makeId: number): Promise<VehicleType[]>;
}

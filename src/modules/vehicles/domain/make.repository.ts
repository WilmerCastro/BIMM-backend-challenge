import type { Make, MakeSummary, VehicleType } from './make.js';

export const MAKE_REPOSITORY = Symbol('MakeRepository');

export type MakeFilter = {
  name?: string;
  vehicleTypeId?: number;
};

export type MakePosition = Pick<MakeSummary, 'makeName' | 'makeId'>;

export type MakePageQuery = MakeFilter & {
  limit: number;
  after?: MakePosition;
};

export interface MakeWriter {
  saveMakes(makes: readonly Make[]): Promise<void>;
}

export interface MakeReader {
  findMakes(query: MakePageQuery): Promise<MakeSummary[]>;
  countMakes(filter?: MakeFilter): Promise<number>;
  findMakeById(makeId: number): Promise<MakeSummary | null>;
  findVehicleTypesByMakeIds(
    makeIds: readonly number[],
  ): Promise<Map<number, VehicleType[]>>;
  findAllVehicleTypes(): Promise<VehicleType[]>;
}

export type MakeRepository = MakeWriter & MakeReader;

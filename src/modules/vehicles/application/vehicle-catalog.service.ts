import { Inject, Injectable } from '@nestjs/common';
import { InvalidInputError } from '../../../common/errors/invalid-input.error.js';
import type { MakeSummary, VehicleType } from '../domain/make.js';
import {
  MAKE_REPOSITORY,
  type MakeFilter,
  type MakeReader,
} from '../domain/make.repository.js';
import { decodeMakeCursor, encodeMakeCursor } from './make-cursor.js';

export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 100;

export type MakesQuery = {
  first?: number;
  after?: string;
  name?: string;
  vehicleTypeId?: number;
};

export type MakePage = {
  nodes: MakeSummary[];
  totalCount: number;
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
};

@Injectable()
export class VehicleCatalogService {
  constructor(@Inject(MAKE_REPOSITORY) private readonly makes: MakeReader) {}

  async listMakes({
    first = DEFAULT_PAGE_SIZE,
    after,
    name,
    vehicleTypeId,
  }: MakesQuery): Promise<MakePage> {
    if (!Number.isInteger(first) || first < 1 || first > MAX_PAGE_SIZE) {
      throw new InvalidInputError(
        `"first" must be between 1 and ${MAX_PAGE_SIZE}`,
      );
    }
    const position = after === undefined ? undefined : decodeMakeCursor(after);
    const filter: MakeFilter = {
      name: name?.trim() || undefined,
      vehicleTypeId,
    };

    const [rows, totalCount] = await Promise.all([
      this.makes.findMakes({ ...filter, limit: first + 1, after: position }),
      this.makes.countMakes(filter),
    ]);

    const nodes = rows.slice(0, first);
    const last = nodes.at(-1);
    return {
      nodes,
      totalCount,
      pageInfo: {
        hasNextPage: rows.length > first,
        endCursor: last ? encodeMakeCursor(last) : null,
      },
    };
  }

  findMake(makeId: number): Promise<MakeSummary | null> {
    return this.makes.findMakeById(makeId);
  }

  listVehicleTypes(): Promise<VehicleType[]> {
    return this.makes.findAllVehicleTypes();
  }

  vehicleTypesForMakes(
    makeIds: readonly number[],
  ): Promise<Map<number, VehicleType[]>> {
    return this.makes.findVehicleTypesByMakeIds(makeIds);
  }
}

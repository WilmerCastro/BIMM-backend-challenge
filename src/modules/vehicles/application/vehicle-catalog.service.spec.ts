import { InvalidInputError } from '../../../common/errors/invalid-input.error.js';
import type { MakeSummary, VehicleType } from '../domain/make.js';
import type {
  MakeFilter,
  MakePageQuery,
  MakeReader,
} from '../domain/make.repository.js';
import { encodeMakeCursor } from './make-cursor.js';
import { VehicleCatalogService } from './vehicle-catalog.service.js';

const catalog: MakeSummary[] = [
  { makeId: 1, makeName: 'ACURA' },
  { makeId: 2, makeName: 'BMW' },
  { makeId: 3, makeName: 'HONDA' },
];

class FakeReader implements MakeReader {
  queries: MakePageQuery[] = [];

  async findMakes(query: MakePageQuery) {
    this.queries.push(query);
    const start = query.after
      ? catalog.findIndex((make) => make.makeId === query.after?.makeId) + 1
      : 0;
    return catalog.slice(start, start + query.limit);
  }

  async countMakes(_filter?: MakeFilter) {
    return catalog.length;
  }

  async findMakeById(makeId: number) {
    return catalog.find((make) => make.makeId === makeId) ?? null;
  }

  async findVehicleTypesByMakeIds(): Promise<Map<number, VehicleType[]>> {
    return new Map();
  }

  async findAllVehicleTypes(): Promise<VehicleType[]> {
    return [];
  }
}

const setup = () => {
  const reader = new FakeReader();
  return { reader, service: new VehicleCatalogService(reader) };
};

describe('VehicleCatalogService.listMakes', () => {
  it('returns a page and says there is more', async () => {
    const { service } = setup();

    const page = await service.listMakes({ first: 2 });

    expect(page.nodes.map((make) => make.makeName)).toEqual(['ACURA', 'BMW']);
    expect(page.totalCount).toBe(3);
    expect(page.pageInfo).toEqual({
      hasNextPage: true,
      endCursor: encodeMakeCursor(catalog[1]),
    });
  });

  it('continues from the cursor of the previous page', async () => {
    const { service } = setup();
    const firstPage = await service.listMakes({ first: 2 });

    const secondPage = await service.listMakes({
      first: 2,
      after: firstPage.pageInfo.endCursor ?? undefined,
    });

    expect(secondPage.nodes.map((make) => make.makeName)).toEqual(['HONDA']);
    expect(secondPage.pageInfo.hasNextPage).toBe(false);
  });

  it('uses 50 makes per page by default', async () => {
    const { service, reader } = setup();

    await service.listMakes({});

    expect(reader.queries[0].limit).toBe(51);
  });

  it('ignores a blank name filter', async () => {
    const { service, reader } = setup();

    await service.listMakes({ name: '   ' });

    expect(reader.queries[0].name).toBeUndefined();
  });

  it.each([0, 101, 1.5])('rejects first = %s', async (first) => {
    const { service } = setup();

    await expect(service.listMakes({ first })).rejects.toThrow(
      InvalidInputError,
    );
  });

  it('rejects a cursor it did not create', async () => {
    const { service } = setup();

    await expect(service.listMakes({ after: 'not-a-cursor' })).rejects.toThrow(
      '"after" is not a valid cursor',
    );
  });

  it('returns an empty page without a cursor when nothing matches', async () => {
    const { service, reader } = setup();
    reader.findMakes = async () => [];

    const page = await service.listMakes({});

    expect(page.pageInfo).toEqual({ hasNextPage: false, endCursor: null });
  });
});

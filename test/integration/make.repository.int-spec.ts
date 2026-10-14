import type { Make } from '../../src/modules/vehicles/domain/make.js';
import { TypeOrmMakeRepository } from '../../src/modules/vehicles/infrastructure/persistence/typeorm-make.repository.js';
import {
  clearTables,
  startTestDatabase,
  stopTestDatabase,
  type TestDatabase,
} from '../support/postgres.js';

const trailer = { typeId: 6, typeName: 'Trailer' };
const car = { typeId: 2, typeName: 'Passenger Car' };
const truck = { typeId: 3, typeName: 'Truck' };

let database: TestDatabase;
let repository: TypeOrmMakeRepository;

const storedCatalog = async (): Promise<Make[]> => {
  const rows: { make_id: number; make_name: string; type_ids: number[] }[] =
    await database.dataSource.query(`
      SELECT m.make_id, m.make_name,
             COALESCE(array_agg(l.type_id ORDER BY l.type_id)
                      FILTER (WHERE l.type_id IS NOT NULL), '{}') AS type_ids
      FROM makes m
      LEFT JOIN make_vehicle_types l ON l.make_id = m.make_id
      GROUP BY m.make_id, m.make_name
      ORDER BY m.make_id
    `);
  const types: { type_id: number; type_name: string }[] =
    await database.dataSource.query(
      'SELECT type_id, type_name FROM vehicle_types',
    );
  const typeName = new Map(types.map((type) => [type.type_id, type.type_name]));

  return rows.map((row) => ({
    makeId: row.make_id,
    makeName: row.make_name,
    vehicleTypes: row.type_ids.map((typeId) => ({
      typeId,
      typeName: typeName.get(typeId) ?? '',
    })),
  }));
};

beforeAll(async () => {
  database = await startTestDatabase();
  repository = new TypeOrmMakeRepository(database.dataSource);
});

afterEach(() => clearTables(database.dataSource));

afterAll(() => stopTestDatabase(database));

describe('TypeOrmMakeRepository', () => {
  it('saves makes with their vehicle types', async () => {
    const makes = [
      { makeId: 440, makeName: 'ASTON MARTIN', vehicleTypes: [car] },
      { makeId: 12858, makeName: '#1 ALPINE CUSTOMS', vehicleTypes: [trailer] },
      { makeId: 1, makeName: 'NO TYPES', vehicleTypes: [] },
    ];

    await repository.saveMakes(makes);

    expect(await storedCatalog()).toEqual(
      [...makes].sort((a, b) => a.makeId - b.makeId),
    );
  });

  it('can save the same makes twice without duplicating anything', async () => {
    const makes = [
      { makeId: 440, makeName: 'ASTON MARTIN', vehicleTypes: [car] },
    ];

    await repository.saveMakes(makes);
    await repository.saveMakes(makes);

    expect(await storedCatalog()).toEqual(makes);
  });

  it('updates a make and replaces its vehicle types', async () => {
    await repository.saveMakes([
      { makeId: 440, makeName: 'ASTON', vehicleTypes: [car, trailer] },
    ]);

    await repository.saveMakes([
      { makeId: 440, makeName: 'ASTON MARTIN', vehicleTypes: [truck] },
    ]);

    expect(await storedCatalog()).toEqual([
      { makeId: 440, makeName: 'ASTON MARTIN', vehicleTypes: [truck] },
    ]);
  });

  it('leaves makes that are not being saved untouched', async () => {
    const other = { makeId: 7, makeName: 'OTHER', vehicleTypes: [trailer] };
    await repository.saveMakes([other]);

    await repository.saveMakes([
      { makeId: 440, makeName: 'ASTON MARTIN', vehicleTypes: [car] },
    ]);

    expect(await storedCatalog()).toContainEqual(other);
  });

  it('saves nothing from a batch when a later write fails', async () => {
    const duplicatedLink = {
      makeId: 2,
      makeName: 'DUPLICATED TYPE',
      vehicleTypes: [trailer, trailer],
    };

    await expect(
      repository.saveMakes([
        { makeId: 1, makeName: 'VALID', vehicleTypes: [car] },
        duplicatedLink,
      ]),
    ).rejects.toThrow();
    expect(await storedCatalog()).toEqual([]);
  });

  it('handles more makes than fit in one insert', async () => {
    const makes = Array.from({ length: 2500 }, (_, index) => ({
      makeId: index + 1,
      makeName: `MAKE ${index + 1}`,
      vehicleTypes: [trailer],
    }));

    await repository.saveMakes(makes);

    expect(await repository.countMakes()).toBe(2500);
  });
});

describe('TypeOrmMakeRepository reads', () => {
  const motorcycle = { typeId: 1, typeName: 'Motorcycle' };

  beforeEach(() =>
    repository.saveMakes([
      { makeId: 3, makeName: 'HONDA', vehicleTypes: [car, motorcycle] },
      { makeId: 1, makeName: 'ACURA', vehicleTypes: [car] },
      { makeId: 2, makeName: 'BMW', vehicleTypes: [car, motorcycle] },
      { makeId: 4, makeName: 'A_B TRAILERS', vehicleTypes: [trailer] },
      { makeId: 5, makeName: 'AXB WORKS', vehicleTypes: [] },
    ]),
  );

  const names = (makes: { makeName: string }[]) =>
    makes.map((make) => make.makeName);

  it('pages through every make in name order without gaps or repeats', async () => {
    const allAtOnce = await repository.findMakes({ limit: 10 });
    const firstPage = await repository.findMakes({ limit: 2 });
    const secondPage = await repository.findMakes({
      limit: 2,
      after: firstPage[1],
    });
    const thirdPage = await repository.findMakes({
      limit: 2,
      after: secondPage[1],
    });

    expect(names([...firstPage, ...secondPage, ...thirdPage])).toEqual(
      names(allAtOnce),
    );
    expect(names(allAtOnce).slice(-2)).toEqual(['BMW', 'HONDA']);
  });

  it('filters by a case-insensitive part of the name', async () => {
    expect(
      names(await repository.findMakes({ limit: 10, name: 'onD' })),
    ).toEqual(['HONDA']);
  });

  it('treats LIKE wildcards in the search as plain text', async () => {
    expect(
      names(await repository.findMakes({ limit: 10, name: 'A_B' })),
    ).toEqual(['A_B TRAILERS']);
  });

  it('filters by a vehicle type the make builds', async () => {
    expect(
      names(
        await repository.findMakes({
          limit: 10,
          vehicleTypeId: motorcycle.typeId,
        }),
      ),
    ).toEqual(['BMW', 'HONDA']);
    expect(
      await repository.countMakes({ vehicleTypeId: motorcycle.typeId }),
    ).toBe(2);
  });

  it('finds a make by id', async () => {
    expect(await repository.findMakeById(2)).toEqual({
      makeId: 2,
      makeName: 'BMW',
    });
    expect(await repository.findMakeById(999)).toBeNull();
  });

  it('loads the vehicle types of several makes in one call', async () => {
    const vehicleTypes = await repository.findVehicleTypesByMakeIds([2, 5, 4]);

    expect(vehicleTypes.get(2)).toEqual([motorcycle, car]);
    expect(vehicleTypes.get(4)).toEqual([trailer]);
    expect(vehicleTypes.has(5)).toBe(false);
  });

  it('lists every vehicle type', async () => {
    expect(await repository.findAllVehicleTypes()).toEqual([
      motorcycle,
      car,
      trailer,
    ]);
  });
});

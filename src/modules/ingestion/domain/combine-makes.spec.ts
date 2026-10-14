import { combineMakesWithVehicleTypes } from './combine-makes.js';

const trailer = { typeId: 6, typeName: 'Trailer' };
const car = { typeId: 2, typeName: 'Passenger Car' };

describe('combineMakesWithVehicleTypes', () => {
  it('builds one entry per make with its vehicle types', () => {
    const makes = [{ makeId: 440, makeName: 'ASTON MARTIN' }];

    expect(
      combineMakesWithVehicleTypes(makes, new Map([[440, [car]]])),
    ).toEqual([{ makeId: 440, makeName: 'ASTON MARTIN', vehicleTypes: [car] }]);
  });

  it('keeps makes that have no vehicle types', () => {
    const makes = [{ makeId: 1, makeName: 'EMPTY' }];

    expect(combineMakesWithVehicleTypes(makes, new Map([[1, []]]))).toEqual([
      { makeId: 1, makeName: 'EMPTY', vehicleTypes: [] },
    ]);
  });

  it('leaves out makes whose vehicle types are missing', () => {
    const makes = [
      { makeId: 1, makeName: 'FETCHED' },
      { makeId: 2, makeName: 'FAILED' },
    ];

    expect(
      combineMakesWithVehicleTypes(makes, new Map([[1, [trailer]]])).map(
        (make) => make.makeName,
      ),
    ).toEqual(['FETCHED']);
  });

  it('removes duplicate makes and vehicle types', () => {
    const makes = [
      { makeId: 1, makeName: 'ACME' },
      { makeId: 1, makeName: 'ACME' },
    ];

    expect(
      combineMakesWithVehicleTypes(makes, new Map([[1, [trailer, car, trailer]]])),
    ).toEqual([{ makeId: 1, makeName: 'ACME', vehicleTypes: [car, trailer] }]);
  });
});

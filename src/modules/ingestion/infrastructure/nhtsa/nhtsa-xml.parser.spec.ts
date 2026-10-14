import {
  TransformationError,
  XmlParseError,
} from '../../domain/ingestion.errors.js';
import { parseMakesXml, parseVehicleTypesXml } from './nhtsa-xml.parser.js';

const response = (results: string) =>
  `<Response xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><Count>0</Count><Message>Response returned successfully</Message>${results}</Response>`;

const make = (id: string, name: string) =>
  `<AllVehicleMakes><Make_ID>${id}</Make_ID><Make_Name>${name}</Make_Name></AllVehicleMakes>`;

const vehicleType = (id: string, name: string) =>
  `<VehicleTypesForMakeIds><VehicleTypeId>${id}</VehicleTypeId><VehicleTypeName>${name}</VehicleTypeName></VehicleTypesForMakeIds>`;

describe('parseMakesXml', () => {
  it('turns the makes list into domain makes', () => {
    const xml = response(
      `<Results>${make('440', 'ASTON MARTIN')}${make('441', 'TESLA')}</Results>`,
    );

    expect(parseMakesXml(xml)).toEqual([
      { makeId: 440, makeName: 'ASTON MARTIN' },
      { makeId: 441, makeName: 'TESLA' },
    ]);
  });

  it('keeps names that look like numbers as text', () => {
    const xml = response(`<Results>${make('11968', '818')}</Results>`);

    expect(parseMakesXml(xml)).toEqual([{ makeId: 11968, makeName: '818' }]);
  });

  it('decodes entities and trims names', () => {
    const xml = response(
      `<Results>${make('7349', '4M FARM &amp; TRAILER SALES ')}</Results>`,
    );

    expect(parseMakesXml(xml)[0].makeName).toBe('4M FARM & TRAILER SALES');
  });

  it('returns an empty list when there are no results', () => {
    expect(parseMakesXml(response('<Results />'))).toEqual([]);
  });

  it('throws XmlParseError on malformed XML', () => {
    expect(() => parseMakesXml('<Response><Results>')).toThrow(XmlParseError);
  });

  it('throws TransformationError when a make has no id', () => {
    const xml = response(
      '<Results><AllVehicleMakes><Make_Name>NO ID</Make_Name></AllVehicleMakes></Results>',
    );

    expect(() => parseMakesXml(xml)).toThrow(TransformationError);
  });
});

describe('parseVehicleTypesXml', () => {
  it('turns a single vehicle type into a one-item list', () => {
    const xml = response(`<Results>${vehicleType('6', 'Trailer')}</Results>`);

    expect(parseVehicleTypesXml(xml, 12858)).toEqual([
      { typeId: 6, typeName: 'Trailer' },
    ]);
  });

  it('returns every vehicle type of the make', () => {
    const xml = response(
      `<Results>${vehicleType('2', 'Passenger Car')}${vehicleType('7', 'Multipurpose Passenger Vehicle (MPV)')}</Results>`,
    );

    expect(parseVehicleTypesXml(xml, 440)).toHaveLength(2);
  });

  it('returns an empty list for a make without vehicle types', () => {
    expect(parseVehicleTypesXml(response('<Results />'), 999999)).toEqual([]);
  });

  it('names the make in the error when the response shape is wrong', () => {
    const xml = response(`<Results>${vehicleType('abc', 'Trailer')}</Results>`);

    expect(() => parseVehicleTypesXml(xml, 440)).toThrow(
      'Unexpected response shape from GetVehicleTypesForMakeId/440',
    );
  });
});

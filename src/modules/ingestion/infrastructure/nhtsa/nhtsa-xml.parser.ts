import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { z } from 'zod';
import type {
  MakeSummary,
  VehicleType,
} from '../../../vehicles/domain/make.js';
import {
  TransformationError,
  XmlParseError,
} from '../../domain/ingestion.errors.js';

const LIST_TAGS = new Set(['AllVehicleMakes', 'VehicleTypesForMakeIds']);

const parser = new XMLParser({
  parseTagValue: false,
  trimValues: true,
  isArray: (tagName) => LIST_TAGS.has(tagName),
});

const id = z.string().regex(/^\d+$/).transform(Number);
const name = z.string().min(1);
const noResults = z.literal('').transform((): [] => []);

const makesResponse = z.object({
  Response: z.object({
    Results: z.union([
      noResults,
      z
        .object({
          AllVehicleMakes: z.array(
            z.object({ Make_ID: id, Make_Name: name }),
          ),
        })
        .transform(({ AllVehicleMakes }) =>
          AllVehicleMakes.map((make) => ({
            makeId: make.Make_ID,
            makeName: make.Make_Name,
          })),
        ),
    ]),
  }),
});

const vehicleTypesResponse = z.object({
  Response: z.object({
    Results: z.union([
      noResults,
      z
        .object({
          VehicleTypesForMakeIds: z.array(
            z.object({ VehicleTypeId: id, VehicleTypeName: name }),
          ),
        })
        .transform(({ VehicleTypesForMakeIds }) =>
          VehicleTypesForMakeIds.map((type) => ({
            typeId: type.VehicleTypeId,
            typeName: type.VehicleTypeName,
          })),
        ),
    ]),
  }),
});

const parseXml = (xml: string, source: string): unknown => {
  const validation = XMLValidator.validate(xml);
  if (validation !== true) {
    throw new XmlParseError(`Invalid XML from ${source}`, {
      source,
      reason: validation.err.msg,
      line: validation.err.line,
    });
  }
  return parser.parse(xml);
};

const transform = <Schema extends z.ZodType>(
  schema: Schema,
  document: unknown,
  source: string,
): z.output<Schema> => {
  const result = schema.safeParse(document);
  if (!result.success) {
    throw new TransformationError(`Unexpected response shape from ${source}`, {
      source,
      issues: z.prettifyError(result.error),
    });
  }
  return result.data;
};

export const parseMakesXml = (xml: string): MakeSummary[] => {
  const source = 'getallmakes';
  return transform(makesResponse, parseXml(xml, source), source).Response
    .Results;
};

export const parseVehicleTypesXml = (
  xml: string,
  makeId: number,
): VehicleType[] => {
  const source = `GetVehicleTypesForMakeId/${makeId}`;
  return transform(vehicleTypesResponse, parseXml(xml, source), source)
    .Response.Results;
};

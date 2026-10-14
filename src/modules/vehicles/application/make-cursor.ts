import { z } from 'zod';
import { InvalidInputError } from '../../../common/errors/invalid-input.error.js';
import type { MakePosition } from '../domain/make.repository.js';

const cursorSchema = z.tuple([z.string(), z.number().int()]);

export const encodeMakeCursor = ({ makeName, makeId }: MakePosition) =>
  Buffer.from(JSON.stringify([makeName, makeId])).toString('base64url');

export const decodeMakeCursor = (cursor: string): MakePosition => {
  try {
    const [makeName, makeId] = cursorSchema.parse(
      JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')),
    );
    return { makeName, makeId };
  } catch {
    throw new InvalidInputError('"after" is not a valid cursor');
  }
};

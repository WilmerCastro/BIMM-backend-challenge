import { chunk } from './chunk.js';

describe('chunk', () => {
  it('splits a list into groups of the given size, keeping the remainder', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('returns no groups for an empty list', () => {
    expect(chunk([], 3)).toEqual([]);
  });
});

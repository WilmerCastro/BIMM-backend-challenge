import { createErrorFormatter } from './format-error.js';

const internal = {
  message: 'relation "makes" does not exist',
  path: ['makes'],
  extensions: { code: 'INTERNAL_SERVER_ERROR', stacktrace: ['at ...'] },
};

describe('createErrorFormatter', () => {
  it('hides the details of internal errors', () => {
    expect(createErrorFormatter(true)(internal)).toEqual({
      message: 'Internal server error',
      path: ['makes'],
      extensions: { code: 'INTERNAL_SERVER_ERROR' },
    });
  });

  it('keeps errors the client caused', () => {
    const badInput = {
      message: '"first" must be between 1 and 100',
      extensions: { code: 'BAD_USER_INPUT' },
    };

    expect(createErrorFormatter(true)(badInput)).toBe(badInput);
  });

  it('shows everything outside production', () => {
    expect(createErrorFormatter(false)(internal)).toBe(internal);
  });
});

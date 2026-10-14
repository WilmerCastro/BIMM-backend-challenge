import { backoffDelay, withRetry } from './retry.js';

const failingTimes = (failures: number, error = new Error('boom')) => {
  let calls = 0;
  const operation = vi.fn(async () => {
    calls += 1;
    if (calls <= failures) throw error;
    return 'ok';
  });
  return operation;
};

const options = {
  retries: 3,
  baseDelayMs: 100,
  shouldRetry: () => true,
  sleep: vi.fn(async (_ms: number) => {}),
  random: () => 1,
};

describe('withRetry', () => {
  it('returns as soon as the operation succeeds', async () => {
    const operation = failingTimes(2);

    await expect(withRetry(operation, options)).resolves.toBe('ok');
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it('gives up after the allowed retries with the last error', async () => {
    const operation = failingTimes(10);

    await expect(withRetry(operation, options)).rejects.toThrow('boom');
    expect(operation).toHaveBeenCalledTimes(4);
  });

  it('does not retry errors that are not retryable', async () => {
    const operation = failingTimes(1);

    await expect(
      withRetry(operation, { ...options, shouldRetry: () => false }),
    ).rejects.toThrow('boom');
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('waits longer after each failed attempt', async () => {
    const sleep = vi.fn(async (_ms: number) => {});

    await withRetry(failingTimes(3), { ...options, sleep });

    expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([100, 200, 400]);
  });
});

describe('backoffDelay', () => {
  it('stays between half and the full exponential delay', () => {
    expect(backoffDelay(3, 100, () => 0)).toBe(200);
    expect(backoffDelay(3, 100, () => 1)).toBe(400);
  });
});

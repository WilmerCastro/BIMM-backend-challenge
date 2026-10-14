import { createRateLimiter } from './rate-limiter.js';

describe('createRateLimiter', () => {
  it('spaces calls made at the same time evenly across the second', async () => {
    const sleep = vi.fn(async (_ms: number) => {});
    const waitForTurn = createRateLimiter(5, { now: () => 0, sleep });

    await Promise.all([waitForTurn(), waitForTurn(), waitForTurn()]);

    expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([200, 400]);
  });

  it('does not wait once enough time has passed', async () => {
    let clock = 0;
    const sleep = vi.fn(async (_ms: number) => {});
    const waitForTurn = createRateLimiter(5, { now: () => clock, sleep });

    await waitForTurn();
    clock = 1000;
    await waitForTurn();

    expect(sleep).not.toHaveBeenCalled();
  });
});

import { mapSettledWithConcurrency } from './map-settled.js';

const tick = () => new Promise((resolve) => setTimeout(resolve, 1));

describe('mapSettledWithConcurrency', () => {
  it('never runs more tasks at once than the limit', async () => {
    let running = 0;
    let maxRunning = 0;

    await mapSettledWithConcurrency(
      Array.from({ length: 20 }, (_, index) => index),
      3,
      async () => {
        running += 1;
        maxRunning = Math.max(maxRunning, running);
        await tick();
        running -= 1;
      },
    );

    expect(maxRunning).toBe(3);
  });

  it('keeps results in the same order as the items', async () => {
    const results = await mapSettledWithConcurrency(
      [30, 10, 20],
      3,
      async (ms) => {
        await new Promise((resolve) => setTimeout(resolve, ms));
        return ms;
      },
    );

    expect(
      results.map((result) => result.status === 'fulfilled' && result.value),
    ).toEqual([30, 10, 20]);
  });

  it('records failures without stopping the other tasks', async () => {
    const results = await mapSettledWithConcurrency(
      [1, 2, 3],
      2,
      async (item) => {
        if (item === 2) throw new Error('make 2 failed');
        return item;
      },
    );

    expect(results.map((result) => result.status)).toEqual([
      'fulfilled',
      'rejected',
      'fulfilled',
    ]);
  });

  it('handles an empty list', async () => {
    await expect(
      mapSettledWithConcurrency([], 5, async () => 1),
    ).resolves.toEqual([]);
  });
});

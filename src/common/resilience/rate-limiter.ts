import { sleep as wait } from './sleep.js';

export type RateLimiterOptions = {
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
};

export const createRateLimiter = (
  requestsPerSecond: number,
  { now = Date.now, sleep = wait }: RateLimiterOptions = {},
) => {
  const intervalMs = 1000 / requestsPerSecond;
  let nextSlot = 0;

  return async () => {
    const current = now();
    const slot = Math.max(current, nextSlot);
    nextSlot = slot + intervalMs;
    if (slot > current) await sleep(slot - current);
  };
};

export type RetryOptions = {
  retries: number;
  baseDelayMs: number;
  shouldRetry: (error: unknown) => boolean;
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
};

const wait = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

export const backoffDelay = (
  attempt: number,
  baseDelayMs: number,
  random: () => number,
) => {
  const exponential = baseDelayMs * 2 ** (attempt - 1);
  return Math.round(exponential / 2 + random() * (exponential / 2));
};

export const withRetry = async <Result>(
  operation: () => Promise<Result>,
  {
    retries,
    baseDelayMs,
    shouldRetry,
    onRetry,
    sleep = wait,
    random = Math.random,
  }: RetryOptions,
): Promise<Result> => {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (attempt > retries || !shouldRetry(error)) throw error;
      const delayMs = backoffDelay(attempt, baseDelayMs, random);
      onRetry?.(error, attempt, delayMs);
      await sleep(delayMs);
    }
  }
};

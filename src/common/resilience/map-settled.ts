export const mapSettledWithConcurrency = async <Item, Result>(
  items: readonly Item[],
  concurrency: number,
  task: (item: Item) => Promise<Result>,
): Promise<PromiseSettledResult<Result>[]> => {
  const results = Array.from<PromiseSettledResult<Result>>({
    length: items.length,
  });
  let nextIndex = 0;

  const worker = async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      try {
        results[index] = { status: 'fulfilled', value: await task(items[index]) };
      } catch (reason) {
        results[index] = { status: 'rejected', reason };
      }
    }
  };

  const workers = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: workers }, worker));
  return results;
};

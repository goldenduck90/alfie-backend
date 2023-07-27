/**
 * Executes a list of async functions in batches of a given size, returning an array of items typed `T`.
 * Optionally stops executing further batches when an `until` predicate returns true given the batch result.
 * @template T The result element type.
 */
export default async function batchAsync<T>(
  /** A list of functions that each return a promise. */
  funcs: (() => Promise<T>)[],
  options: {
    /** The number of promises to execute in parallel per batch. */
    batchSize?: number
    /** Upon completion of a batch, if the predicate is true, stops executing further batches and returns the results so far. */
    until?: (batchResult: T[]) => boolean
    /** Upon completion of a batch, if the asynchronous predicate is true, stops executing further batches and returns the results so far. */
    untilAsync?: (batchResult: T[]) => Promise<boolean>
  } = {}
) {
  const { batchSize = 10, until, untilAsync } = options

  const result: T[] = []
  for (let index = 0; index < funcs.length; index += batchSize) {
    const funcsBatch = funcs.slice(index, index + batchSize)
    const items = await Promise.all(funcsBatch.map((func) => func()))
    result.push(...items)

    if ((until && until(items)) || (untilAsync && (await untilAsync(items)))) {
      return result
    }
  }
  return result
}

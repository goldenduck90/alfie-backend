/**
 * Executes a list of async functions in batches of a given size, returning an array of items typed `T`.
 * @template T The result element type.
 */
export default async function batchAsync<T>(
  /** A list of functions that each return a promise. */
  funcs: (() => Promise<T>)[],
  /** The number of promises to execute in parallel per batch. */
  batchSize = 10
) {
  const result: T[] = []
  for (let index = 0; index < funcs.length; index += batchSize) {
    const funcsBatch = funcs.slice(index, index + batchSize)
    const items = await Promise.all(funcsBatch.map((func) => func()))
    result.push(...items)
  }
  return result
}

/**
 * Creates a map for a collection using a function to get the key
 * field by which to reference each element. The result is a map with
 * `{ [retrievedKey: string]: T }`. Useful for collections where the key
 * field is unique to each element.
 */
export const mapCollectionByField = <T>(
  collection: T[],
  getField: (item: T) => string
): Record<string, T> =>
  collection.reduce((map, item) => ({ ...map, [getField(item)]: item }), {})

/** Maps a collection by grouping items by a calculated field from `getField`. */
export const groupCollectionByField = <T>(
  collection: T[],
  getField: (item: T) => string
): Record<string, T[]> =>
  collection.reduce((map, item) => {
    const field = getField(item)
    return { ...map, [field]: [...(map[field] ?? []), item] }
  }, {} as Record<string, T[]>)

/**
 * Remove duplicate entries from items, using a function to extract a comparable string from each item.
 * Prioritizes entries earlier in the list.
 */
export const uniqueItems = <T>(
  items: T[],
  getComparisonValue: (item: T) => string
) => {
  const map: Record<string, boolean> = {}
  const results: T[] = []
  items.forEach((item) => {
    const value = getComparisonValue(item)
    if (!map[value]) {
      results.push(item)
      map[value] = true
    }
  })

  return results
}

/**
 * Sorts the items by an extracted value.
 */
export const sorted = <T>(
  items: T[],
  /** Extract a property that is comparable from an element in `items`. */
  getComparisonValue: (item: T) => any,
  order: "ascending" | "descending" = "ascending"
) =>
  items
    // add the computed comparison value
    .map((item) => ({ item, value: getComparisonValue(item) }))
    // sort by the value
    .sort(
      ({ value: a }, { value: b }) =>
        (b > a ? 1 : b === a ? 0 : -1) * (order === "ascending" ? -1 : 1)
    )
    // map to the item, without the computed value
    .map(({ item }) => item)

/** Returns an array with the `subArray` repeated `times` times. */
export const repeat = <T>(subArray: T[], times: number) => {
  if (times < 0)
    throw new TypeError("repeat `times` argument must be non-negative.")

  return new Array(times)
    .fill(null)
    .map(() => [...subArray])
    .flatMap((x) => x)
}

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

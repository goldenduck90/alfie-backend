/**
 * Creates a map for a collection using a function to get the key
 * field by which to reference each element. The result is a map with
 * `{ [retrievedKey: string]: T }`. Used as an alternative
 */
const mapCollectionByField = <T>(
  collection: T[],
  getField: (item: T) => string
): Record<string, T> =>
  collection.reduce((map, item) => ({ ...map, [getField(item)]: item }), {})

export default mapCollectionByField

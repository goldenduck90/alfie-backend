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

/**
 * Returns an array with the `subArray` repeated `times` times.
 */
export const repeat = <T>(subArray: T[], times: number) => {
  if (times < 0)
    throw new TypeError("repeat `times` argument must be non-negative.")

  return new Array(times)
    .fill(null)
    .map(() => [...subArray])
    .flatMap((x) => x)
}

/**
 * Picks fields from the object to create a new object with just those fields.
 */
export const pickFields = <T, F extends keyof T>(
  obj: T,
  ...fields: F[]
): Pick<T, F> => {
  const result: Pick<T, F> = {} as any
  fields.forEach((key) => (result[key] = obj[key]))
  return result
}

/**
 * Returns whether the two objects or values are equal,
 * recursively checking array elements and object properties.
 */
export function deepEquals(obj1: any, obj2: any): boolean
export function deepEquals(
  obj1: any,
  obj2: any,
  stack1: any[],
  stack2: any[]
): boolean
export function deepEquals(
  obj1: any,
  obj2: any,
  stack1: any[] = [],
  stack2: any[] = []
): boolean {
  // prevent circular references
  const checkCircular = (stack: any[], obj: any) =>
    stack.some((s) => typeof s === "object" && s === obj)
  if (checkCircular(stack1, obj1) || checkCircular(stack2, obj2)) {
    return false
  }

  stack1.push(obj1)
  stack2.push(obj2)

  const recurse = () => {
    const getType = (obj: unknown) => {
      if (obj instanceof Array) return "array"
      else if (obj === null) return "null"
      else return typeof obj
    }

    const type1 = getType(obj1)
    const type2 = getType(obj2)
    if (type1 !== type2) return false
    if (type1 === "array" && obj1 instanceof Array && obj2 instanceof Array) {
      if (obj1.length !== obj2.length) return false
      const sameValues = obj1.every((_, index) =>
        deepEquals(obj1[index], obj2[index], stack1, stack2)
      )
      return sameValues
    } else if (type1 === "object") {
      const keys1 = sorted(Object.keys(obj1), (k) => k)
      const keys2 = sorted(Object.keys(obj2), (k) => k)
      const sameKeys = deepEquals(keys1, keys2, stack1, stack2)
      if (!sameKeys) return false

      const sameValues = keys1.every((k) =>
        deepEquals(obj1[k], obj2[k], stack1, stack2)
      )
      return sameValues
    } else {
      return obj1 === obj2
    }
  }

  const result = recurse()
  stack1.pop()
  stack2.pop()

  return result
}

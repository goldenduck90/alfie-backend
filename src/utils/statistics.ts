/**
 * The identity function when T is a number.
 */
export const numericIdentityFunction = <T>(item: T): number =>
  item as unknown as number

/**
 * Whether the given array of items is null or empty.
 */
export const isEmpty = <T>(items: T[]): boolean => !items || items.length === 0

/**
 * Returns the sum of the given items. If items are numbers,
 * `getValue` is optional.
 */
export const sum = <T>(
  items: T[],
  getValue: (item: T) => number = numericIdentityFunction,
  defaultValue: number | null = null
) =>
  isEmpty(items)
    ? defaultValue
    : items.map((item) => getValue(item)).reduce((e, value) => e + value, 0)

/**
 * Returns the mean (average) of the given items.
 */
export const mean = <T>(
  items: T[],
  getValue: (item: T) => number = numericIdentityFunction,
  defaultValue: number | null = null
) =>
  isEmpty(items)
    ? defaultValue
    : sum(items, getValue, defaultValue) / items.length

/**
 * Calculates the variance from the given items.
 */
export const variance = <T>(
  items: T[],
  getValue: (item: T) => number = numericIdentityFunction,
  defaultValue: number | null = null
) => {
  if (isEmpty(items)) {
    return defaultValue
  } else {
    // sum(x => (x - u)^2) / n
    const values = items.map(getValue)
    const mu = mean(values)
    const s2 = sum(values.map((x) => (x - mu) ** 2)) / values.length

    return s2
  }
}

/**
 * Returns a range of integers from start to end (exclusive).
 */
export const range = (start: number, end: number, step = 1) => {
  const numbers = Math.ceil((end - start) / step)
  return new Array(numbers).fill(null).map((a, i) => start + i * step)
}

/** A map of ordinal suffixes for 0-9 (0"th", 1"st", 2"nd", etc). */
const ordinalMap = ["th", "st", "nd", "rd", "th", "th", "th", "th", "th", "th"]

/**
 * Returns the given number as an ordinal string, e.g. 7th.
 */
export const ordinal = (num: number): string => {
  if (!Number.isFinite(num)) return null

  const integer = num < 0 ? Math.ceil(num) : Math.floor(num)
  const lastDigit = Math.abs(integer) % 10
  return `${integer}${ordinalMap[lastDigit]}`
}

/** Generates a random integer from `from` to `to`, not including `to`. */
export const randomInt = (from: number, to: number) =>
  from + Math.floor(Math.random() * (to - from))

import gaussian from "gaussian"

/**
 * The identity function when T is a number.
 */
export const numericIdentityFunction = <T>(item: T): number => item as unknown as number

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
    : items.map((item) => getValue(item)).reduce((sum, value) => sum + value, 0)

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
    const variance = sum(values.map((x) => (x - mu) ** 2)) / values.length

    return variance
  }
}

/**
 * Returns a range of integers from start to end (exclusive).
 */
export const range = (start: number, end: number, step: number = 1) => {
  const numbers = Math.ceil((end - start) / step)
  return new Array(numbers).fill(null).map((a, i) => start + i * step)
}

/**
 * Calculates the percentile of a `value` within a normal
 * distribution with parameters `mean` (μ) and `standardDeviation` (σ).
 */
export class NormalDistribution {
  public distribution: gaussian.Gaussian

  constructor(public mean: number, public standardDeviation: number) {
    this.distribution = gaussian(mean, standardDeviation ** 2)
  }

  /**
   * Get the rounded percentile of the value for this distribution. (E.g. pdf)
   * or probability density function.
   */
  percentile(value: number): number {
    return Math.floor(this.distribution.cdf(value) * 100)
  }

  /**
   * Gets the percentile of the value for this distribution, returning the percentile
   * as an ordinal, e.g. "71st"
   */
  ordinal(value: number): string {
    return ordinal(this.percentile(value))
  }
}

/** A map of ordinal suffixes for 0-9 (0"th", 1"st", 2"nd", etc). */
const ordinalMap = ["th", "st", "nd", "rd", "th", "th", "th", "th", "th", "th"]

/**
 * Returns the given number as an ordinal string, e.g. 7th.
 */
export const ordinal = (num: number): string => {
  if (!Number.isFinite(num))
    return null

  const integer = num < 0 ? Math.ceil(num) : Math.floor(num)
  const lastDigit = Math.abs(integer) % 10
  return `${integer}${ordinalMap[lastDigit]}`
}

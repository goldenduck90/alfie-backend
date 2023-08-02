import gaussian from "gaussian"
import { ordinal } from "./statistics"

/**
 * Calculates the percentile of a `value` within a normal
 * distribution with parameters `mean` (μ) and `standardDeviation` (σ).
 */
export class NormalDistribution {
  public distribution: gaussian.Gaussian

  constructor(public mean: number, public standardDeviation: number) {
    this.distribution = gaussian(this.mean, this.standardDeviation ** 2)
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

import {
  Classification,
  ClassificationType,
  Score,
} from "../schema/user.schema"
import { TaskType } from "../schema/task.schema"
import { calculateSetting, calculateSettings } from "../utils/calculateSetting"

/**
 * Given this array of objects we need to classify a patient as each of the following and their percentile for each classification:
 * 1. Growler
 * 2. Empath
 * 3. Ember
 * 4. Rover

 * The criteria for each classification is as follows:

 * Empath:
 * If the HADS(task: MP_FEELING) Anxiety Score is in the top 75th percentile, the person is classified as an Empath

 * Ember:
 * If the person’s activity (task: MP_ACTIVITY) level is in the bottom 25th percentile, they are classified as an ember
 * If bottom 25th percentile then really we need to display 75th percentile

 * Growler:
 * If the person is in the bottom 25th percentile for satiety(hunger at 2 hours) (task: MP_HUNGER), they are a growler (i.e.they don’t feel full)
 * If bottom 25th percentile then really we need to display 75th percentile

 * Rover:
 * If the person is in the top 25 % for ad libitum (task: AD_LIBITUM) calories eaten, they are classified as a rover
 * If the person is in the bottom 25 % for hunger(30 minutes) (task: MP_HUNGER), they can also be classified as rover
 * If your bottom 25th percentile then really we need to display 75th percentile
 */
export function classifyUser(scores: Score[]): Classification[] {
  const classifications: Classification[] = []

  for (const score of scores) {
    switch (score.task) {
      case TaskType.MP_ACTIVITY:
      case TaskType.AD_LIBITUM:
      case TaskType.MP_FEELING: {
        const { classificationType, inverse } =
          calculateSetting<{
            classificationType: ClassificationType
            inverse: boolean
          }>(
            classificationCriteria,
            ["classificationType", "inverse"],
            score
          )

        if (classificationType) {
          classifications.push({
            date: score.date,
            classification: classificationType,
            percentile: inverse
              ? inversePercentile(score.percentile)
              : score.percentile,
            calculatedPercentile: inverse
              ? inversePercentile(score.calculatedPercentile)
              : score.calculatedPercentile
          })
        }
        break
      }
      case TaskType.MP_HUNGER: {
        const { classificationType, inverse } =
          calculateSettings<{
            classificationType: ClassificationType[]
            inverse: boolean[]
          }>(
            classificationCriteria,
            ["classificationType", "inverse"],
            score
          )

        const hungerClassifications: Classification[] =
          classificationType.map((classification, index) => ({
            classification,
            date: score.date,
            percentile: inverse[index] ? inversePercentile(score.percentile) : score.percentile,
            calculatedPercentile: inverse[index] ? inversePercentile(score.calculatedPercentile) : score.calculatedPercentile,
          }))

        classifications.push(...hungerClassifications)
        break
      }
      default:
        break
    }
  }

  return classifications
}

/**
 * Returns the inverse of a percentile. For example, the inverse of 80 is 20, or `100 - p`.
 * Returns the percentile in the same type passed, string or number.
 */
function inversePercentile(percentile: string): string;
function inversePercentile(percentile: number): number;
function inversePercentile(percentile: string | number): string | number {
  if (typeof percentile === "string") {
    return `${Math.min(99, 100 - parseInt(percentile))}`
  } else if (typeof percentile === "number") {
    return Math.min(100 - percentile, 99)
  } else {
    return percentile
  }
}

export const classificationCriteria = [
  {
    vars: { classificationType: ClassificationType.Empath, inverse: false },
    conditions: [{
      task: TaskType.MP_FEELING,
      calculatedPercentile: { range: [75, 100] },
    }],
  },
  {
    vars: { classificationType: ClassificationType.Ember, inverse: true },
    conditions: [{
      task: TaskType.MP_ACTIVITY,
      calculatedPercentile: { range: [0, 25] },
    }],
  },
  {
    vars: { classificationType: ClassificationType.Growler, inverse: true },
    conditions: [{
      task: TaskType.MP_HUNGER,
      calculatedPercentile1Hour: { range: [0, 25] },
    }],
  },
  {
    vars: { classificationType: ClassificationType.Rover, inverse: true },
    conditions: [
      { task: TaskType.MP_HUNGER, calculatedPercentile30Minutes: { range: [0, 25] } },
    ],
  },
  {
    vars: { test: 10, classificationType: ClassificationType.Rover, inverse: false },
    conditions: [
      { task: TaskType.AD_LIBITUM, calculatedPercentile: { range: [75, 100] } },
    ],
  }
]

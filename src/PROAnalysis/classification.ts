import {
  Classification,
  ClassificationType,
  Score,
} from "../schema/user.schema"
import { TaskType } from "../schema/task.schema"

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
      case TaskType.MP_FEELING: {
        const mpPercentile = score.percentile.toString().split("th")[0]
        if (!mpPercentile) break

        classifications.push({
          calculatedPercentile: score.calculatedPercentile,
          classification: ClassificationType.Empath,
          percentile: mpPercentile,
          date: score.date,
        })
        break
      }
      case TaskType.MP_ACTIVITY: {
        const activityPercentile = score.percentile.toString().split("th")[0]
        if (!activityPercentile) break

        classifications.push({
          calculatedPercentile: score.calculatedPercentile,
          classification: ClassificationType.Ember,
          percentile: activityPercentile,
          displayPercentile:
            parseInt(activityPercentile) === 25 ? "75" : activityPercentile,
          date: score.date,
        })
        break
      }
      case TaskType.MP_HUNGER: {
        const hungerPercentile1hour = score.percentile1hour
        const hungerPercentile30 = score.percentile30mins
        if (!hungerPercentile1hour || !hungerPercentile30) {
          classifications.push({
            classification: ClassificationType.Growler,
            percentile: "0",
            displayPercentile: "0",
            date: score.date,
          })
        }
        if (parseInt(hungerPercentile1hour) <= 25) {
          classifications.push({
            classification: ClassificationType.Growler,
            percentile: score.percentile1hour,
            // TODO: should this be the existing field `calculated30minsPercent` on Classification in user.schema.ts?
            calculatedPercentile30Mins:
              score.calculated30minsPercent ?? parseInt(score.percentile30mins),
            calculatedPercentile2Hour:
              score.calculated1hourPercent ?? parseInt(score.percentile1hour),
            displayPercentile:
              parseInt(hungerPercentile1hour) === 25
                ? "75"
                : hungerPercentile1hour,
            date: score.date,
          })
        } else if (parseInt(hungerPercentile30) >= 75) {
          classifications.push({
            calculatedPercentile30Mins:
              score.calculated30minsPercent ?? parseInt(score.percentile30mins),
            calculatedPercentile2Hour:
              score.calculated1hourPercent ?? parseInt(score.percentile1hour),
            classification: ClassificationType.Rover,
            percentile: score.percentile30mins,
            date: score.date,
          })
        }
        break
      }
      case TaskType.AD_LIBITUM: {
        const adLibitumPercentile = parseInt(score.percentile)
        if (!adLibitumPercentile) {
          classifications.push({
            classification: ClassificationType.Rover,
            percentile: "0",
            displayPercentile: "0",
            date: score.date,
          })
        } else {
          classifications.push({
            classification: ClassificationType.Rover,
            percentile: score.percentile.toString(),
            calculatedPercentile: score.calculatedPercentile,
            displayPercentile:
              adLibitumPercentile === 25 ? "75" : String(adLibitumPercentile),
            date: score.date,
          })
        }
        break
      }
      default:
        break
    }
  }

  return classifications
}

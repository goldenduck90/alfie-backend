/* eslint-disable no-case-declarations */


// Given this array of objects we need to classify a patient as each of the following and their percentile for each classification:
// 1. Growler
// 2. Empath
// 3. Ember
// 4. Rover

// The criteria for each classification is as follows:

// Empath:
// If the HADS(task: MP_FEELING) Anxiety Score is in the top 75th percentile, the person is classified as an Empath

// Ember:
// If the person’s activity (task: MP_ACTIVITY) level is in the bottom 25th percentile, they are classified as an ember
// If your bottom 25th percentile then really we need to display 75th percentile

// Growler:
// If the person is in the bottom 25th percentile for satiety(hunger at 2 hours) (task: MP_HUNGER), they are a growler(i.e.they don’t feel full)
// If your bottom 25th percentile then really we need to display 75th percentile

// Rover:
// If the person is in the top 25 % for ad libitum (task: AD_LIBITUM) calories eaten, they are classified as a rover
// If the person is in the bottom 25 % for hunger(30 minutes) (task: MP_HUNGER), they can also be classified as rover
// If your bottom 25th percentile then really we need to display 75th percentile


type Score = {
  percentile30mins: any
  percentile1hour: any
  latest: string | number
  score?: number
  date: Date
  increased?: boolean
  calculatedPercentile?: number
  calculated1hourPercent?: number
  calculated30minsPercent?: number
  percentile?: number
  message: string
  task: string
  scoreSystolic?: number
  scoreDiastolic?: number
  increasedSystolic?: boolean
  increasedDiastolic?: boolean
  percentileSystolic?: number
  percentileDiastolic?: number
  providerMessage?: string
}

export function classifyUser(
  scores: Score[]
): { classification: string, percentile: string }[] {
  const classifications: {
    classification: string
    percentile: string
    calculatedPercentile?: number
    calculatedPercentile30Mins?: number
    calculatedPercentile2Hour?: number
    displayPercentile?: string
    date: Date
  }[] = []
  for (const score of scores) {
    switch (score.task) {
      case "MP_FEELING":
        const mpPercentile = score.percentile.toString().split("th")[0]
        if (!mpPercentile) break
        classifications.push({
          calculatedPercentile: score.calculatedPercentile,
          classification: "Empath",
          percentile: mpPercentile,
          date: score.date,
        })
        break
      case "MP_ACTIVITY":
        const activityPercentile = score.percentile.toString().split("th")[0]
        if (!activityPercentile) break
        classifications.push({
          classification: "Ember",
          percentile: activityPercentile,
          displayPercentile:
            Number(activityPercentile) === 25 ? "75" : activityPercentile,
          date: score.date,
        })
        break
      case "MP_HUNGER":
        const hungerPercentile1hour = score.percentile1hour
        const hungerPercentile30 = score.percentile30mins
        if (!hungerPercentile1hour || !hungerPercentile30) break
        if (Number(hungerPercentile1hour) <= 25) {
          classifications.push({
            classification: "Growler",
            percentile: score.percentile1hour,
            displayPercentile:
              Number(hungerPercentile1hour) === 25
                ? "75"
                : hungerPercentile1hour,
            date: score.date,
          })
        } else if (Number(hungerPercentile30) >= 75) {
          classifications.push({
            calculatedPercentile30Mins: score.calculated30minsPercent,
            calculatedPercentile2Hour: score.calculated1hourPercent,
            classification: "Rover",
            percentile: score.percentile30mins,
            date: score.date,
          })
        }
        break
      case "AD_LIBITUM":
        const adLibitumPercentile = Number(score.percentile)
        if (!adLibitumPercentile) break
        classifications.push({
          classification: "Rover",
          percentile: score.percentile.toString(),
          calculatedPercentile: score.calculatedPercentile,
          displayPercentile:
            Number(adLibitumPercentile) === 25
              ? "75"
              : adLibitumPercentile.toString(),
          date: score.date,
        })
        break
      default:
        break
    }
  }

  return classifications
}

/* eslint-disable no-case-declarations */
// const score = [{ "latest": "245", "score": new NumberInt("0"), "date": new ISODate("2023-01-15T16:48:09.122Z"), "increased": false, "percentile": new NumberInt("0"), "message": "Your weight has decreased by 0%", "task": "WEIGHT_LOG" }, { "latest": "246", "score": new NumberInt("0"), "date": new ISODate("2023-01-19T22:58:45.344Z"), "increased": false, "percentile": new NumberInt("0"), "message": "Your weight has decreased by 0%", "task": "WEIGHT_LOG" }, { "latest": "145/95", "scoreSystolic": new NumberInt("0"), "scoreDiastolic": new NumberInt("0"), "date": new ISODate("2023-01-19T22:59:53.161Z"), "increasedSystolic": false, "increasedDiastolic": false, "percentileSystolic": new NumberInt("0"), "percentileDiastolic": new NumberInt("0"), "message": "Your systolic has decreased by 0% and your diastolic has decreased by 0%", "task": "BP_LOG", "providerMessage": "Your systolic is > 140 or diastolic is > 90, go to next highest category. If above 130/80, ask if they are taking htn drugs." }, { "latest": new NumberInt("42"), "score": new NumberInt("0"), "date": new ISODate("2023-01-19T23:13:52.131Z"), "increased": false, "percentile": new NumberInt("0"), "message": "Your waist has decreased by 0%", "task": "WAIST_LOG" }, { "latest": "140/95", "scoreSystolic": new NumberInt("3"), "scoreDiastolic": new NumberInt("0"), "date": new ISODate("2023-01-27T00:17:15.496Z"), "increasedSystolic": false, "increasedDiastolic": false, "percentileSystolic": new NumberInt("3"), "percentileDiastolic": new NumberInt("0"), "message": "Your systolic has decreased by 3% and your diastolic has decreased by 0%", "task": "BP_LOG", "providerMessage": "Your systolic is > 140 or diastolic is > 90, go to next highest category. If above 130/80, ask if they are taking htn drugs." }, { "latest": "246", "score": new NumberInt("0"), "date": new ISODate("2023-01-27T00:18:02.128Z"), "increased": false, "percentile": new NumberInt("0"), "message": "Your weight has decreased by 0%", "task": "WEIGHT_LOG" }, { "latest": "246", "score": new NumberInt("0"), "date": new ISODate("2023-01-27T00:18:09.780Z"), "increased": false, "percentile": new NumberInt("0"), "message": "Your weight has decreased by 0%", "task": "WEIGHT_LOG" }]

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

// Growler:
// If the person is in the bottom 25th percentile for satiety(hunger at 2 hours) (task: MP_HUNGER), they are a growler(i.e.they don’t feel full)

// Rover:
// If the person is in the top 25 % for ad libitum (task: AD_LIBITUM) calories eaten, they are classified as a rover
// If the person is in the bottom 25 % for hunger(30 minutes) (task: MP_HUNGER), they can also be classified as rover

type Score = {
  percentile30mins: any
  percentile1hour: any
  latest: string | number
  score?: number
  date: Date
  increased?: boolean
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
): { classification: string, percentile: number }[] {
  const classifications: {
    classification: string
    percentile: number
    date: Date
  }[] = []
  for (const score of scores) {
    switch (score.task) {
      case "MP_FEELING":
        // only use the latest score by score.date for each task for classification
        const mostRecentScore = scores.find(
          (s) =>
            s.task === score.task && s.date.getTime() === score.date.getTime()
        )
        const mpPercentile = mostRecentScore.percentile
          .toString()
          .split("th")[0]
        if (!mpPercentile || !mostRecentScore) break
        if (Number(mpPercentile) >= 75) {
          classifications.push({
            classification: "Empath",
            percentile: score.percentile,
            date: mostRecentScore.date,
          })
        }
        break
      case "MP_ACTIVITY":
        const mostRecentActivityScore = scores.find(
          (s) =>
            s.task === score.task && s.date.getTime() === score.date.getTime()
        )
        const activityPercentile = mostRecentActivityScore.percentile
          .toString()
          .split("th")[0]
        if (!activityPercentile || !mostRecentActivityScore) break
        if (Number(activityPercentile) <= 25) {
          classifications.push({
            classification: "Ember",
            percentile: score.percentile,
            date: mostRecentActivityScore.date,
          })
        }
        break
      case "MP_HUNGER":
        const mostRecentHungerScore = scores.find(
          (s) =>
            s.task === score.task && s.date.getTime() === score.date.getTime()
        )
        const hungerPercentile1hour = mostRecentHungerScore.percentile1hour
        const hungerPercentile30 = mostRecentHungerScore.percentile30mins
        if (!hungerPercentile1hour || !hungerPercentile30) break
        if (Number(hungerPercentile1hour) <= 25) {
          classifications.push({
            classification: "Growler",
            percentile: score.percentile1hour,
            date: mostRecentHungerScore.date,
          })
        } else if (Number(hungerPercentile30) >= 75) {
          classifications.push({
            classification: "Rover",
            percentile: score.percentile30mins,
            date: mostRecentHungerScore.date,
          })
        }
        break
      case "AD_LIBITUM":
        const mostRecentAdLibitumScore = scores.find(
          (s) =>
            s.task === score.task && s.date.getTime() === score.date.getTime()
        )
        const adLibitumPercentile = mostRecentAdLibitumScore.percentile
        console.log(mostRecentAdLibitumScore, "mostRecentAdLibitumScore")
        if (!adLibitumPercentile) break
        if (Number(adLibitumPercentile) >= 75) {
          classifications.push({
            classification: "Rover",
            percentile: score.percentile,
            date: mostRecentAdLibitumScore.date,
          })
        }
        break
      default:
        break
    }
  }

  return classifications
}

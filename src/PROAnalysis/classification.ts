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
// If your bottom 25th percentile then really we need to display 75th percentile

// Growler:
// If the person is in the bottom 25th percentile for satiety(hunger at 2 hours) (task: MP_HUNGER), they are a growler(i.e.they don’t feel full)
// If your bottom 25th percentile then really we need to display 75th percentile

// Rover:
// If the person is in the top 25 % for ad libitum (task: AD_LIBITUM) calories eaten, they are classified as a rover
// If the person is in the bottom 25 % for hunger(30 minutes) (task: MP_HUNGER), they can also be classified as rover
// If your bottom 25th percentile then really we need to display 75th percentile

//  [{"latest": "8", "score": new NumberInt("1"), "date": new ISODate("2022-12-15T18:42:56.037Z"), "increased": true, "percentDifference": new NumberInt("14"), "message": "You scored within the 90th percentile", "task": "MP_FEELI NG"} , {"latest": "1 hour: 20, 30 mins: 1", "score1hour": new NumberInt("23"), "score30mins": new NumberInt("89"), "date": new ISODate("2022-12-15T18:43:18.685Z"), "increased1Hour": false, "increased30Mins": false, "percentDifference1Hour": new NumberInt("23"), "percentDifference30Mins": new NumberInt("89"), "message": "Your hunger level has decreased by 23% for 1 hour and decreased by 89% for 30 mins and you scored within the 0 percentile for 1 hour and 0 percentile for 30 mins", "task": "MP_HUNG ER"} , {"latest": "212", "score": new NumberInt("2"), "date": new ISODate("2023-01-02T18:02:47.706Z"), "increased": true, "percentDifference": new NumberInt("1"), "message": "Your weight has increased by 1%", "task": "WEIGHT_L OG"} , {"latest": "112/68", "scoreSystolic": new NumberInt("2"), "scoreDiastolic": new NumberInt("0"), "date": new ISODate("2022-12-27T22:58:45.462Z"), "increasedSystolic": false, "increasedDiastolic": false, "percentDifferenceSystolic": new NumberInt("2"), "percentDifferenceDiastolic": new NumberInt("0"), "message": "Your systolic has decreased by 2% and your diastolic has decreased by 0%", "task": "BP_LOG", "providerMessage":  ""} , {"latest": "12000", "score": new NumberInt("1000"), "date": new ISODate("2022-12-15T18:38:56.235Z"), "increased": true, "percentDifference": new NumberInt("9"), "message": "You scored within the 95th percentile", "task": "MP_ACTIVI TY"} , {"latest": new NumberInt("43"), "score": new NumberInt("0"), "date": new ISODate("2022-12-11T02:45:29.882Z"), "increased": false, "percentDifference": new NumberInt("0"), "message": "Your waist has decreased by 0%", "task": "WAIST_L OG"} , {"latest": "8", "score": new NumberInt("1"), "date": new ISODate("2022-12-15T18:42:56.037Z"), "increased": true, "percentDifference": new NumberInt("14"), "message": "You scored within the 90th percentile", "task": "MP_FEELI NG"} , {"latest": "1 hour: 20, 30 mins: 1", "score1hour": new NumberInt("23"), "score30mins": new NumberInt("89"), "date": new ISODate("2022-12-15T18:43:18.685Z"), "increased1Hour": false, "increased30Mins": false, "percentDifference1Hour": new NumberInt("23"), "percentDifference30Mins": new NumberInt("89"), "message": "Your hunger level has decreased by 23% for 1 hour and decreased by 89% for 30 mins and you scored within the 0 percentile for 1 hour and 0 percentile for 30 mins", "task": "MP_HUNG ER"} , {"latest": "212", "score": new NumberInt("2"), "date": new ISODate("2023-01-02T18:02:47.706Z"), "increased": true, "percentDifference": new NumberInt("1"), "message": "Your weight has increased by 1%", "task": "WEIGHT_L OG"} , {"latest": "112/68", "scoreSystolic": new NumberInt("2"), "scoreDiastolic": new NumberInt("0"), "date": new ISODate("2022-12-27T22:58:45.462Z"), "increasedSystolic": false, "increasedDiastolic": false, "percentDifferenceSystolic": new NumberInt("2"), "percentDifferenceDiastolic": new NumberInt("0"), "message": "Your systolic has decreased by 2% and your diastolic has decreased by 0%", "task": "BP_LOG", "providerMessage":  ""} , {"latest": "12000", "score": new NumberInt("1000"), "date": new ISODate("2022-12-15T18:38:56.235Z"), "increased": true, "percentDifference": new NumberInt("9"), "message": "You scored within the 95th percentile", "task": "MP_ACTIVI TY"} , {"latest": new NumberInt("43"), "score": new NumberInt("0"), "date": new ISODate("2022-12-11T02:45:29.882Z"), "increased": false, "percentDifference": new NumberInt("0"), "message": "Your waist has decreased by 0%", "task": "WAIST_L OG"} , {"latest": "8", "score": new NumberInt("1"), "date": new ISODate("2022-12-15T18:42:56.037Z"), "increased": true, "percentDifference": new NumberInt("14"), "message": "You scored within the 90th percentile", "task": "MP_FEELI NG"} , {"latest": "1 hour: 20, 30 mins: 1", "score1hour": new NumberInt("23"), "score30mins": new NumberInt("89"), "date": new ISODate("2022-12-15T18:43:18.685Z"), "increased1Hour": false, "increased30Mins": false, "percentDifference1Hour": new NumberInt("23"), "percentDifference30Mins": new NumberInt("89"), "message": "Your hunger level has decreased by 23% for 1 hour and decreased by 89% for 30 mins and you scored within the 0 percentile for 1 hour and 0 percentile for 30 mins", "task": "MP_HUNG ER"} , {"latest": "212", "score": new NumberInt("2"), "date": new ISODate("2023-01-02T18:02:47.706Z"), "increased": true, "percentDifference": new NumberInt("1"), "message": "Your weight has increased by 1%", "task": "WEIGHT_L OG"} , {"latest": "112/68", "scoreSystolic": new NumberInt("2"), "scoreDiastolic": new NumberInt("0"), "date": new ISODate("2022-12-27T22:58:45.462Z"), "increasedSystolic": false, "increasedDiastolic": false, "percentDifferenceSystolic": new NumberInt("2"), "percentDifferenceDiastolic": new NumberInt("0"), "message": "Your systolic has decreased by 2% and your diastolic has decreased by 0%", "task": "BP_LOG", "providerMessage":  ""} , {"latest": "12000", "score": new NumberInt("1000"), "date": new ISODate("2022-12-15T18:38:56.235Z"), "increased": true, "percentDifference": new NumberInt("9"), "message": "You scored within the 95th percentile", "task": "MP_ACTIVI TY"} , {"latest": new NumberInt("43"), "score": new NumberInt("0"), "date": new ISODate("2022-12-11T02:45:29.882Z"), "increased": false, "percentDifference": new NumberInt("0"), "message": "Your waist has decreased by 0%", "task": "WAIST_L OG"} , {"latest": "8", "score": new NumberInt("1"), "date": new ISODate("2022-12-15T18:42:56.037Z"), "increased": true, "percentDifference": new NumberInt("14"), "message": "You scored within the 90th percentile", "task": "MP_FEELI NG"} , {"latest": "1 hour: 20, 30 mins: 1", "score1hour": new NumberInt("23"), "score30mins": new NumberInt("89"), "date": new ISODate("2022-12-15T18:43:18.685Z"), "increased1Hour": false, "increased30Mins": false, "percentDifference1Hour": new NumberInt("23"), "percentDifference30Mins": new NumberInt("89"), "message": "Your hunger level has decreased by 23% for 1 hour and decreased by 89% for 30 mins and you scored within the 0 percentile for 1 hour and 0 percentile for 30 mins", "task": "MP_HUNG ER"} , {"latest": "212", "score": new NumberInt("2"), "date": new ISODate("2023-01-02T18:02:47.706Z"), "increased": true, "percentDifference": new NumberInt("1"), "message": "Your weight has increased by 1%", "task": "WEIGHT_L OG"} , {"latest": "112/68", "scoreSystolic": new NumberInt("2"), "scoreDiastolic": new NumberInt("0"), "date": new ISODate("2022-12-27T22:58:45.462Z"), "increasedSystolic": false, "increasedDiastolic": false, "percentDifferenceSystolic": new NumberInt("2"), "percentDifferenceDiastolic": new NumberInt("0"), "message": "Your systolic has decreased by 2% and your diastolic has decreased by 0%", "task": "BP_LOG", "providerMessage":  ""} , {"latest": "12000", "score": new NumberInt("1000"), "date": new ISODate("2022-12-15T18:38:56.235Z"), "increased": true, "percentDifference": new NumberInt("9"), "message": "You scored within the 95th percentile", "task": "MP_ACTIVI TY"} , {"latest": new NumberInt("43"), "score": new NumberInt("0"), "date": new ISODate("2022-12-11T02:45:29.882Z"), "increased": false, "percentDifference": new NumberInt("0"), "message": "Your waist has decreased by 0%", "task": "WAIST_L OG"} , {"latest": "8", "score": new NumberInt("1"), "date": new ISODate("2022-12-15T18:42:56.037Z"), "increased": true, "percentDifference": new NumberInt("14"), "message": "You scored within the 90th percentile", "task": "MP_FEELI NG"} , {"latest": "1 hour: 20, 30 mins: 1", "score1hour": new NumberInt("23"), "score30mins": new NumberInt("89"), "date": new ISODate("2022-12-15T18:43:18.685Z"), "increased1Hour": false, "increased30Mins": false, "percentDifference1Hour": new NumberInt("23"), "percentDifference30Mins": new NumberInt("89"), "message": "Your hunger level has decreased by 23% for 1 hour and decreased by 89% for 30 mins and you scored within the 0 percentile for 1 hour and 0 percentile for 30 mins", "task": "MP_HUNG ER"} , {"latest": "212", "score": new NumberInt("2"), "date": new ISODate("2023-01-02T18:02:47.706Z"), "increased": true, "percentDifference": new NumberInt("1"), "message": "Your weight has increased by 1%", "task": "WEIGHT_L OG"} , {"latest": "112/68", "scoreSystolic": new NumberInt("2"), "scoreDiastolic": new NumberInt("0"), "date": new ISODate("2022-12-27T22:58:45.462Z"), "increasedSystolic": false, "increasedDiastolic": false, "percentDifferenceSystolic": new NumberInt("2"), "percentDifferenceDiastolic": new NumberInt("0"), "message": "Your systolic has decreased by 2% and your diastolic has decreased by 0%", "task": "BP_LOG", "providerMessage":  ""} , {"latest": "12000", "score": new NumberInt("1000"), "date": new ISODate("2022-12-15T18:38:56.235Z"), "increased": true, "percentDifference": new NumberInt("9"), "message": "You scored within the 95th percentile", "task": "MP_ACTIVI TY"} , {"latest": new NumberInt("43"), "score": new NumberInt("0"), "date": new ISODate("2022-12-11T02:45:29.882Z"), "increased": false, "percentDifference": new NumberInt("0"), "message": "Your waist has decreased by 0%", "task": "WAIST_L OG"} , {"latest": "8", "score": new NumberInt("1"), "date": new ISODate("2022-12-15T18:42:56.037Z"), "increased": true, "percentDifference": new NumberInt("14"), "message": "You scored within the 90th percentile", "task": "MP_FEELI NG"} , {"latest": "1 hour: 20, 30 mins: 1", "score1hour": new NumberInt("23"), "score30mins": new NumberInt("89"), "date": new ISODate("2022-12-15T18:43:18.685Z"), "increased1Hour": false, "increased30Mins": false, "percentDifference1Hour": new NumberInt("23"), "percentDifference30Mins": new NumberInt("89"), "message": "Your hunger level has decreased by 23% for 1 hour and decreased by 89% for 30 mins and you scored within the 0 percentile for 1 hour and 0 percentile for 30 mins", "task": "MP_HUNG ER"} , {"latest": "212", "score": new NumberInt("2"), "date": new ISODate("2023-01-02T18:02:47.706Z"), "increased": true, "percentDifference": new NumberInt("1"), "message": "Your weight has increased by 1%", "task": "WEIGHT_L OG"} , {"latest": "112/68", "scoreSystolic": new NumberInt("2"), "scoreDiastolic": new NumberInt("0"), "date": new ISODate("2022-12-27T22:58:45.462Z"), "increasedSystolic": false, "increasedDiastolic": false, "percentDifferenceSystolic": new NumberInt("2"), "percentDifferenceDiastolic": new NumberInt("0"), "message": "Your systolic has decreased by 2% and your diastolic has decreased by 0%", "task": "BP_LOG", "providerMessage":  ""} , {"latest": "12000", "score": new NumberInt("1000"), "date": new ISODate("2022-12-15T18:38:56.235Z"), "increased": true, "percentDifference": new NumberInt("9"), "message": "You scored within the 95th percentile", "task": "MP_ACTIVI TY"} , {"latest": new NumberInt("43"), "score": new NumberInt("0"), "date": new ISODate("2022-12-11T02:45:29.882Z"), "increased": false, "percentDifference": new NumberInt("0"), "message": "Your waist has decreased by 0%", "task": "WAIST_L OG"} , {"latest": "8", "score": new NumberInt("1"), "date": new ISODate("2022-12-15T18:42:56.037Z"), "increased": true, "percentDifference": new NumberInt("14"), "message": "You scored within the 90th percentile", "task": "MP_FEELI NG"} , {"latest": "1 hour: 20, 30 mins: 1", "score1hour": new NumberInt("23"), "score30mins": new NumberInt("89"), "date": new ISODate("2022-12-15T18:43:18.685Z"), "increased1Hour": false, "increased30Mins": false, "percentDifference1Hour": new NumberInt("23"), "percentDifference30Mins": new NumberInt("89"), "message": "Your hunger level has decreased by 23% for 1 hour and decreased by 89% for 30 mins and you scored within the 0 percentile for 1 hour and 0 percentile for 30 mins", "task": "MP_HUNG ER"} , {"latest": "212", "score": new NumberInt("2"), "date": new ISODate("2023-01-02T18:02:47.706Z"), "increased": true, "percentDifference": new NumberInt("1"), "message": "Your weight has increased by 1%", "task": "WEIGHT_L OG"} , {"latest": "112/68", "scoreSystolic": new NumberInt("2"), "scoreDiastolic": new NumberInt("0"), "date": new ISODate("2022-12-27T22:58:45.462Z"), "increasedSystolic": false, "increasedDiastolic": false, "percentDifferenceSystolic": new NumberInt("2"), "percentDifferenceDiastolic": new NumberInt("0"), "message": "Your systolic has decreased by 2% and your diastolic has decreased by 0%", "task": "BP_LOG", "providerMessage":  ""} , {"latest": "12000", "score": new NumberInt("1000"), "date": new ISODate("2022-12-15T18:38:56.235Z"), "increased": true, "percentDifference": new NumberInt("9"), "message": "You scored within the 95th percentile", "task": "MP_ACTIVI TY"} , {"latest": new NumberInt("43"), "score": new NumberInt("0"), "date": new ISODate("2022-12-11T02:45:29.882Z"), "increased": false, "percentDifference": new NumberInt("0"), "message": "Your waist has decreased by 0%", "task": "WAIST_L OG"} , {"latest": "8", "score": new NumberInt("1"), "date": new ISODate("2022-12-15T18:42:56.037Z"), "increased": true, "percentDifference": new NumberInt("14"), "message": "You scored within the 90th percentile", "task": "MP_FEELI NG"} , {"latest": "1 hour: 20, 30 mins: 1", "score1hour": new NumberInt("23"), "score30mins": new NumberInt("89"), "date": new ISODate("2022-12-15T18:43:18.685Z"), "increased1Hour": false, "increased30Mins": false, "percentDifference1Hour": new NumberInt("23"), "percentDifference30Mins": new NumberInt("89"), "message": "Your hunger level has decreased by 23% for 1 hour and decreased by 89% for 30 mins and you scored within the 0 percentile for 1 hour and 0 percentile for 30 mins", "task": "MP_HUNG ER"} , {"latest": "212", "score": new NumberInt("2"), "date": new ISODate("2023-01-02T18:02:47.706Z"), "increased": true, "percentDifference": new NumberInt("1"), "message": "Your weight has increased by 1%", "task": "WEIGHT_L OG"} , {"latest": "112/68", "scoreSystolic": new NumberInt("2"), "scoreDiastolic": new NumberInt("0"), "date": new ISODate("2022-12-27T22:58:45.462Z"), "increasedSystolic": false, "increasedDiastolic": false, "percentDifferenceSystolic": new NumberInt("2"), "percentDifferenceDiastolic": new NumberInt("0"), "message": "Your systolic has decreased by 2% and your diastolic has decreased by 0%", "task": "BP_LOG", "providerMessage":  ""} , {"latest": "12000", "score": new NumberInt("1000"), "date": new ISODate("2022-12-15T18:38:56.235Z"), "increased": true, "percentDifference": new NumberInt("9"), "message": "You scored within the 95th percentile", "task": "MP_ACTIVI TY"} , {"latest": new NumberInt("43"), "score": new NumberInt("0"), "date": new ISODate("2022-12-11T02:45:29.882Z"), "increased": false, "percentDifference": new NumberInt("0"), "message": "Your waist has decreased by 0%", "task": "WAIST_L OG"} , {"latest": "8", "score": new NumberInt("1"), "date": new ISODate("2022-12-15T18:42:56.037Z"), "increased": true, "percentDifference": new NumberInt("14"), "message": "You scored within the 90th percentile", "task": "MP_FEELI NG"} , {"latest": "1 hour: 20, 30 mins: 1", "score1hour": new NumberInt("23"), "score30mins": new NumberInt("89"), "date": new ISODate("2022-12-15T18:43:18.685Z"), "increased1Hour": false, "increased30Mins": false, "percentDifference1Hour": new NumberInt("23"), "percentDifference30Mins": new NumberInt("89"), "message": "Your hunger level has decreased by 23% for 1 hour and decreased by 89% for 30 mins and you scored within the 0 percentile for 1 hour and 0 percentile for 30 mins", "task": "MP_HUNG ER"} , {"latest": "212", "score": new NumberInt("2"), "date": new ISODate("2023-01-02T18:02:47.706Z"), "increased": true, "percentDifference": new NumberInt("1"), "message": "Your weight has increased by 1%", "task": "WEIGHT_L OG"} , {"latest": "112/68", "scoreSystolic": new NumberInt("2"), "scoreDiastolic": new NumberInt("0"), "date": new ISODate("2022-12-27T22:58:45.462Z"), "increasedSystolic": false, "increasedDiastolic": false, "percentDifferenceSystolic": new NumberInt("2"), "percentDifferenceDiastolic": new NumberInt("0"), "message": "Your systolic has decreased by 2% and your diastolic has decreased by 0%", "task": "BP_LOG", "providerMessage":  ""} , {"latest": "12000", "score": new NumberInt("1000"), "date": new ISODate("2022-12-15T18:38:56.235Z"), "increased": true, "percentDifference": new NumberInt("9"), "message": "You scored within the 95th percentile", "task": "MP_ACTIVI TY"} , {"latest": new NumberInt("43"), "score": new NumberInt("0"), "date": new ISODate("2022-12-11T02:45:29.882Z"), "increased": false, "percentDifference": new NumberInt("0"), "message": "Your waist has decreased by 0%", "task": "WAIST_L OG"} , {"latest": "205", "score": new NumberInt("-7"), "date": new ISODate("2023-02-02T03:45:09.880Z"), "increased": false, "percentDifference": new NumberInt("3"), "message": "Your weight has decreased by 3%", "task": "WEIGHT_L OG"} , {"latest": "205", "score": new NumberInt("-7"), "date": new ISODate("2023-02-02T03:45:12.425Z"), "increased": false, "percentDifference": new NumberInt("3"), "message": "Your weight has decreased by 3%", "task": "WEIGHT_L OG"} , {"latest": "205", "score": new NumberInt("-7"), "date": new ISODate("2023-02-02T03:45:16.937Z"), "increased": false, "percentDifference": new NumberInt("3"), "message": "Your weight has decreased by 3%", "task": "WEIGHT_L OG"} , {"latest": "114/65", "scoreSystolic": new NumberInt("2"), "scoreDiastolic": new NumberInt("4"), "date": new ISODate("2023-02-02T03:46:05.618Z"), "increasedSystolic": true, "increasedDiastolic": false, "percentDifferenceSystolic": new NumberInt("2"), "percentDifferenceDiastolic": new NumberInt("4"), "message": "Your systolic has increased by 2% and your diastolic has decreased by 4%", "task": "BP_LOG", "providerMessage":  ""} , {"latest": "205", "score": new NumberInt("0"), "date": new ISODate("2023-02-02T03:46:09.361Z"), "increased": false, "percentDifference": new NumberInt("0"), "message": "Your weight has decreased by 0%", "task": "WEIGHT_L OG"} , {"latest": "205", "score": new NumberInt("0"), "date": new ISODate("2023-02-02T03:46:12.489Z"), "increased": false, "percentDifference": new NumberInt("0"), "message": "Your weight has decreased by 0%", "task": "WEIGHT_L OG"} , {"latest": "4", "score": new NumberInt("-4"), "date": new ISODate("2023-02-02T03:47:50.714Z"), "increased": false, "percentDifference": new NumberInt("50"), "message": "You scored within the 50th percentile", "task": "MP_FEELI NG"} , {"latest": "12000", "score": new NumberInt("0"), "date": new ISODate("2023-02-02T03:49:14.828Z"), "increased": false, "percentDifference": new NumberInt("0"), "message": "You scored within the 95th percentile", "task": "MP_ACTIVI TY"} , {"latest": "1 hour: 77, 30 mins: 87", "score1hour": new NumberInt("285"), "score30mins": new NumberInt("8600"), "date": new ISODate("2023-02-02T03:49:56.702Z"), "increased1Hour": true, "increased30Mins": true, "percentDifference1Hour": new NumberInt("285"), "percentDifference30Mins": new NumberInt("8600"), "message": "Your hunger level has increased by 285% for 1 hour and increased by 8600% for 30 mins and you scored within the 50th percentile for 1 hour and 75th percentile for 30 mins", "task": "MP_HUNG ER"}]
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
): { classification: string, percentile: string }[] {
  const classifications: {
    classification: string
    percentile: string
    displayPercentile?: string
    date: Date
  }[] = []
  for (const score of scores) {
    switch (score.task) {
      case "MP_FEELING":
        // only use the latest score by score.date for each task for classification
        const mpPercentile = score.percentile.toString().split("th")[0]
        if (!mpPercentile) break
        if (Number(mpPercentile) >= 75) {
          classifications.push({
            classification: "Empath",
            percentile: mpPercentile,
            date: score.date,
          })
        }
        break
      case "MP_ACTIVITY":
        // const mostRecentActivityScore = scores.find(
        //     (s) =>
        //         s.task === score.task && s.date.getTime() === score.date.getTime() && s.percentile !== null && s.percentile !== undefined
        // )
        console.log(score, "activityPercentile")
        const activityPercentile = score.percentile.toString().split("th")[0]
        if (!activityPercentile) break
        if (Number(activityPercentile) <= 25) {
          classifications.push({
            classification: "Ember",
            percentile: activityPercentile,
            displayPercentile:
              Number(activityPercentile) === 25 ? "75" : activityPercentile,
            date: score.date,
          })
        }
        break
      case "MP_HUNGER":
        // const mostRecentHungerScore = scores.find(
        //     (s) =>
        //         s.task === score.task && s.date.getTime() === score.date.getTime()
        // )
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
            classification: "Rover",
            percentile: score.percentile30mins,
            date: score.date,
          })
        }
        break
      case "AD_LIBITUM":
        // const mostRecentAdLibitumScore = scores.find(
        //     (s) =>
        //         s.task === score.task && s.date.getTime() === score.date.getTime()
        // )
        const adLibitumPercentile = Number(score.percentile)
        if (!adLibitumPercentile) break
        if (Number(adLibitumPercentile) >= 25) {
          classifications.push({
            classification: "Rover",
            percentile: score.percentile.toString(),
            displayPercentile:
              Number(adLibitumPercentile) === 25
                ? "75"
                : adLibitumPercentile.toString(),
            date: score.date,
          })
        }
        break
      default:
        break
    }
  }

  return classifications
}

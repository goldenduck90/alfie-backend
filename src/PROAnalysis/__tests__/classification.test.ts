import { TaskType } from "../../schema/task.schema"
import { ClassificationType, Score } from "../../schema/user.schema"
import { sorted } from "../../utils/collections"
import { classifyUser } from "../classification"

// Notes:
// - If someone is classified as multiple, then list all of the ones they are
//   classified as, as well as the percentile (I believe we gave the mean and
//   SD, so you can calculate the percentile from these assuming it’s normal)

describe("classification", () => {
  const dates = ["01", "03", "05", "07", "09", "11", "13", "15", "17"]
    .map((day) => new Date(`2023-07-${day}T00:00:00.000Z`))

  /**
   * Rover: 
   * If the person is in the top 25% for ad libitum calories eaten, they are classified as a rover
   */
  describe("Should classify Rover from Ad Libitum correctly", () => {

    const adLibitumTests: { score: Score; expected: ClassificationType }[] = ([
      [dates[0], 25, 25, null],
      [dates[1], 15, 25, null],
      [dates[2], 50, 50, null],
      [dates[3], 80, 75, ClassificationType.Rover],
      [dates[3], 74, 75, null],
      [dates[4], 60, 50, null],
      [dates[5], 90, 99, ClassificationType.Rover],
    ] as [Date, number, number, ClassificationType | null][])
      .map(([date, calculatedPercentile, percentile, expected]) => ({
        score: {
          task: TaskType.AD_LIBITUM,
          date,
          calculatedPercentile,
          percentile,
        } as Score,
        expected,
      }))

    it.each(adLibitumTests)("Classification ($date, $percentile, $calculatedPercentile)", ({ score, expected }) => {
      const classifications = classifyUser([score])
      expect(classifications).toMatchSnapshot()
      if (expected) {
        expect(classifications).toHaveLength(1)
        expect(classifications[0].classification).toEqual(expected)
      } else {
        expect(classifications).toHaveLength(0)
      }
    })
  })

  /**
   * Growler:
   * - If the person is in the bottom 25th percentile for satiety
   *   (hunger at 2 hours), they are a growler (i.e. they don't feel full)
   * Rover:
   * - If the person is in the bottom 25% for hunger (30 minutes),
   *   they can also be classified as rover
   */
  describe("Should classify Growler/Rover from Hunger correctly", () => {
    const dataPoints = ([
      [dates[0], 0, 0, 5, 8, [ClassificationType.Growler, ClassificationType.Rover]],
      [dates[1], 25, 0, 30, 7, [ClassificationType.Growler]],
      [dates[2], 0, 25, 15, 26, [ClassificationType.Rover]],
      [dates[3], 50, 50, 60, 45, []],
      [dates[4], 75, 50, 80, 63, []],
      [dates[5], 50, 75, 48, 82, []],
      [dates[6], 75, 75, 80, 67, []],
    ] as [Date, number, number, number, number, ClassificationType[]][])

    const hungerTests: { score: Score; expected: ClassificationType[] }[] = dataPoints
      .map(([date, percentile30Minutes, percentile1Hour, calculatedPercentile30Minutes, calculatedPercentile1Hour, expected]) => ({
        score: {
          task: TaskType.MP_HUNGER,
          date,
          calculatedPercentile30Minutes,
          calculatedPercentile1Hour,
          calculatedPercentile: calculatedPercentile30Minutes,
          percentile1Hour,
          percentile30Minutes,
        } as Score,
        expected,
      }))

    it.each(hungerTests)("Classification ($score.date, $score.calculatedPercentile30Minutes, $score.calculatedPercentile1Hour)", ({ score, expected }) => {
      const classifications = classifyUser([score])
      expect(classifications).toMatchSnapshot()
      const classificationTypes = classifications
        .map(({ classification }) => classification)
      expect(sorted(classificationTypes, (x) => x, "ascending"))
        .toEqual(expected)
    })
  })

  /**
   * Ember: 
   * If the person’s activity level is in the bottom 25th percentile,
   * they are classified as an ember.
   */
  describe("Should classify Ember from Activity correctly", () => {
    const activityTests: { score: Score; expected: ClassificationType | null }[] = ([
      [dates[0], 75, 80, null],
      [dates[1], 25, 30, null],
      [dates[2], 50, 60, null],
      [dates[3], 0, 5, ClassificationType.Ember],
      [dates[3], 25, 24, ClassificationType.Ember],
    ] as [Date, number, number, ClassificationType | null][])
      .map(([date, percentile, calculatedPercentile, expected]) => ({
        score: {
          date,
          task: TaskType.MP_ACTIVITY,
          percentile,
          calculatedPercentile,
        },
        expected,
      }))

      it.each(activityTests)("Classification ($score.date, $score.percentile, $score.calculatedPercentile)", ({ score, expected }) => {
        const classifications = classifyUser([score])
        expect(classifications).toMatchSnapshot()
        if (expected) {
          expect(classifications).toHaveLength(1)
          expect(classifications[0].classification).toEqual(expected)
        } else {
          expect(classifications).toHaveLength(0)
        }
      })
  })

  /**
   * Empath:
   * If the HADS Anxiety Score is in the top 75th percentile,
   * the person is classified as an Empath
   */
  describe("Should classify Empath from Feeling Task", () => {
    const feelingTests = ([
      [dates[0], 0, 5, null],
      [dates[1], 25, 30, null],
      [dates[2], 50, 60, null],
      [dates[3], 50, 76, ClassificationType.Empath],
      [dates[3], 75, 74, null],
      [dates[3], 75, 76, ClassificationType.Empath],
    ] as [Date, number, number, ClassificationType | null][])
      .map(([date, percentile, calculatedPercentile, expected]) => ({
        score: {
          date,
          percentile,
          calculatedPercentile,
          task: TaskType.MP_FEELING,
        } as Score,
        expected
      }))
    
    it.each(feelingTests)("Classification ($score.date, $score.percentile, $score.calculatedPercentile)", ({ score, expected }) => {
      const classifications =  classifyUser([score])
      if (!expected) {
        expect(classifications).toHaveLength(0)
      } else {
        expect(classifications).toHaveLength(1)
        expect(classifications[0].classification).toEqual(expected)
      }
    })
  })
})

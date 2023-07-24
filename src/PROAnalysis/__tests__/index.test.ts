import { calculateScore, sumAnswersByMap } from ".."
import AnswerType from "../../schema/enums/AnswerType"
import { TaskModel, TaskType } from "../../schema/task.schema"
import { UserAnswerTypes, UserTask } from "../../schema/task.user.schema"
import { repeat } from "../../utils/collections"
import { connectToMongo, disconnect } from "../../utils/mongo"
import { range } from "../../utils/statistics"
import { distributions } from "../distributions"
import { mpFeelingQuestions } from "../questions"

describe("Score calculation", () => {

  beforeAll(() => connectToMongo())
  afterAll(() => disconnect())

  const answerSets = [
    {
      type: TaskType.MP_FEELING,
      name: "low percentile",
      answers: repeat([0], 7),
      previousAnswers: repeat([0], 7),
      questionsMap: mpFeelingQuestions,
    },
    {
      type: TaskType.MP_FEELING,
      name: "mid percentile",
      answers: repeat([1, 2], 3).concat([1]),
      previousAnswers: repeat([2, 1], 3).concat([2]),
      questionsMap: mpFeelingQuestions,
    },
    {
      type: TaskType.MP_FEELING,
      name: "high percentile",
      answers: repeat([3], 7),
      previousAnswers: repeat([2, 4], 3).concat([3]),
      questionsMap: mpFeelingQuestions,
    },
    {
      type: TaskType.MP_ACTIVITY,
      name: "low percentile",
      answers: [3000],
      previousAnswers: [2750],
    },
    {
      type: TaskType.MP_ACTIVITY,
      name: "mid percentile",
      answers: [3375],
      previousAnswers: [3500],
    },
    {
      type: TaskType.MP_ACTIVITY,
      name: "high percentile",
      answers: [9001],
      previousAnswers: [8000],
    },
    {
      type: TaskType.MP_ACTIVITY,
      name: "highest percentile",
      answers: [12000],
      previousAnswers: [10000],
    },
    {
      type: TaskType.AD_LIBITUM,
      name: "lowest percentile",
      answers: [500],
      previousAnswers: [400],
    },
    {
      type: TaskType.AD_LIBITUM,
      name: "low percentile",
      answers: [700],
      previousAnswers: [600],
    },
    {
      type: TaskType.AD_LIBITUM,
      name: "mid percentile",
      answers: [800],
      previousAnswers: [900],
    },
    {
      type: TaskType.AD_LIBITUM,
      name: "mid-high percentile",
      answers: [900],
      previousAnswers: [950],
    },
    {
      type: TaskType.AD_LIBITUM,
      name: "mid-high percentile 2",
      answers: [1001],
      previousAnswers: [1300],
    },
    {
      type: TaskType.AD_LIBITUM,
      name: "high percentile",
      answers: [1100],
      previousAnswers: [1150],
    },
    {
      type: TaskType.AD_LIBITUM,
      name: "highest percentile",
      answers: [1300],
      previousAnswers: [1200],
    },
    {
      type: TaskType.MP_HUNGER,
      name: "low hunger level, more hungry",
      answers: ["." as any, 15, 30],
      previousAnswers: ["." as any, 10, 28],
    },
    {
      type: TaskType.MP_HUNGER,
      name: "low hunger level, less hungry",
      answers: ["." as any, 30, 15],
      previousAnswers: ["." as any, 40, 20],
    },
    {
      type: TaskType.MP_HUNGER,
      name: "high hunger level, more hungry",
      answers: ["." as any, 80, 90],
      previousAnswers: ["." as any, 70, 80],
    },
    {
      type: TaskType.MP_HUNGER,
      name: "high hunger level, less hungry",
      answers: ["." as any, 90, 80],
      previousAnswers: ["." as any, 100, 70],
    },
  ]

  test.each(answerSets)(
    "$type $name",
    async ({ type, answers, previousAnswers, questionsMap }) => {
      const userTask = new UserTask()
      const previousUserTask = new UserTask()
      const task = await TaskModel.findOne({ type })
      const questions = task.questions
      expect(questions).toBeTruthy()

      const date = new Date("2023-01-01T00:00:00.000Z")
      const previousDate = new Date("2022-11-01T00:00:00.000Z")

      userTask.completedAt = date
      previousUserTask.completedAt = previousDate

      const formatAnswers = (entries: number[]) =>
        questions.map(
          (question, index) =>
            ({
              key: question.key,
              type: question.type,
              value:
                question.type === AnswerType.STRING && questionsMap
                  ? Object.keys(questionsMap[question.key])[entries[index]]
                  : entries[index],
            } as UserAnswerTypes)
          )

      userTask.answers = formatAnswers(answers)
      previousUserTask.answers = formatAnswers(previousAnswers)

      const firstScore = calculateScore(null, userTask, task.type)
      expect(firstScore).toMatchSnapshot()

      const changeScore = calculateScore(previousUserTask, userTask, task.type)
      expect(changeScore).toMatchSnapshot()
    }
  )

  describe("sumAnswersByMap", () => {
    it("should reduce string values from a map", () => {
      const result = sumAnswersByMap(
        [
          { key: "a", type: AnswerType.STRING, value: "one" },
          { key: "b", type: AnswerType.STRING, value: "two" },
          { key: "c", type: AnswerType.STRING, value: "three" },
        ],
        {
          a: { one: 5 },
          b: { two: 10 },
          c: { three: 15 },
          d: { etc: 20 },
        }
      )

      expect(result).toBe(5 + 10 + 15)
    })

    it("should use numeric values for NUMBER type answers", () => {
      const result = sumAnswersByMap(
        [
          { key: "a", type: AnswerType.STRING, value: "one" },
          { key: "b", type: AnswerType.NUMBER, value: 10 },
        ],
        { a: { one: 3 } }
      )

      expect(result).toBe(10 + 3)
    })
  })

  describe("percentiles calculation", () => {
    test("getHadsPercentile", () => {
      const results = range(0, 21)
        .map((score) => ({
          score,
          p: distributions.MP_FEELING.calculated.percentile(score),
        }))
        .map(({ score, p }) => `Score ${score}: ${p}`)

      expect(results).toMatchSnapshot()
    })

    test("getStepsPercentile", () => {
      const results = range(1000, 13000, 500)
        .map((steps) => ({
          steps,
          p: distributions.MP_ACTIVITY.calculated.percentile(steps),
        }))
        .map(({ steps, p }) => `Score ${steps}: ${p}`)

      expect(results).toMatchSnapshot()
    })

    test("getHungerPercentile", () => {
      const results = range(0, 101)
        .map((level) => ({
          level,
          p: distributions.MP_HUNGER.display.percentile(level),
        }))
        .map(({ level, p }) => `Level ${level}: ${p}`)

      expect(results).toMatchSnapshot()
    })

    test("getHungerDifferencePercentile", () => {
      const results = range(0, 101)
        .map((level) => ({
          level,
          p: distributions.MP_HUNGER.calculated.percentile(level),
        }))
        .map(({ level, p }) => `Level ${level}: ${p}`)

      expect(results).toMatchSnapshot()
    })
  })
})

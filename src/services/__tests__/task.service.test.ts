import { initializeCollection } from "../../database/initializeCollection"
import AnswerType from "../../schema/enums/AnswerType"
import { Task, TaskModel, TaskType } from "../../schema/task.schema"
import { UserAnswerTypes, UserTask } from "../../schema/task.user.schema"
import { ClassificationType, User } from "../../schema/user.schema"
import { connectToMongo, disconnect } from "../../utils/tests/mongo"
import { createTestUser } from "../../utils/tests/createTestDocument"
import TaskService from "../task.service"
import UserService from "../user.service"
import tasksData from "../../database/data/tasks.json"

jest.mock("../akute.service")
jest.mock("../email.service")
jest.mock("../../utils/sentry")

describe("Task Service", () => {
  beforeAll(async () => {
    await connectToMongo()

    // populate tasks collection
    await initializeCollection<Task>(TaskModel, tasksData, (task) => task.type)
  })

  afterAll(() => disconnect())

  const taskService = new TaskService()
  const userService = new UserService()

  const createUserTasks = async (user: User) =>
    await Promise.all(
      [
        TaskType.AD_LIBITUM,
        TaskType.MP_ACTIVITY,
        TaskType.MP_HUNGER,
        TaskType.MP_FEELING,
      ].map(async (taskType) => {
        const userTask = await taskService.assignTaskToUser({
          taskType,
          userId: user._id.toString(),
        })
        const task = await taskService.getTaskByType(taskType)
        return { task, userTask }
      })
    )

  const completeUserTask = async (task: Task, userTask: UserTask) => {
    let answers: UserAnswerTypes[] = []

    switch (task.type) {
      case TaskType.MP_ACTIVITY:
        answers = [
          { key: "stepsPerDay", type: AnswerType.NUMBER, value: 10000 },
        ]
        break
      case TaskType.MP_HUNGER:
        answers = [
          { key: "foodEaten", type: AnswerType.STRING, value: "a" },
          { key: "hungerLevel30Mins", type: AnswerType.NUMBER, value: 80 },
          { key: "hungerLevel1Hour", type: AnswerType.NUMBER, value: 80 },
        ]
        break
      case TaskType.MP_FEELING:
        answers = [
          {
            key: "tenseLevel",
            type: AnswerType.STRING,
            value: "A lot of the time",
          },
          {
            key: "frightenedLevel",
            type: AnswerType.STRING,
            value: "A lot of the time",
          },
          {
            key: "worryAmount",
            type: AnswerType.STRING,
            value: "A lot of the time",
          },
          {
            key: "easeFrequency",
            type: AnswerType.STRING,
            value: "A lot of the time",
          },
          {
            key: "frightenedFrequency",
            type: AnswerType.STRING,
            value: "A lot of the time",
          },
          {
            key: "restlessAmount",
            type: AnswerType.STRING,
            value: "A lot of the time",
          },
          {
            key: "panicFrequency",
            type: AnswerType.STRING,
            value: "A lot of the time",
          },
        ]
        break
      case TaskType.AD_LIBITUM:
        answers = [{ key: "calories", type: AnswerType.NUMBER, value: 2000 }]
        break
    }

    await taskService.completeUserTask({
      _id: userTask._id,
      answers,
    })
  }

  test(
    "recalculateProfiling",
    async () => {
      const user = await createTestUser()
      const userId = user._id.toString()
      const tasks = await createUserTasks(user)

      await taskService.recalculateProfiling(userId)
      const user1 = await userService.getUser(userId)

      // tasks assigned but not completed
      expect(user1.score).toHaveLength(0)
      expect(user1.classifications).toHaveLength(4)

      await Promise.all(
        tasks.map(
          async ({ task, userTask }) => await completeUserTask(task, userTask)
        )
      )

      // one set of tasks completed
      // await taskService.recalculateProfiling(userId)
      const user2 = await userService.getUser(userId)
      expect(user2.score).toHaveLength(4)
      expect(user2.classifications).toHaveLength(1)

      // two sets of tasks completed
      const tasks2 = await createUserTasks(user)
      await Promise.all(
        tasks2.map(
          async ({ task, userTask }) => await completeUserTask(task, userTask)
        )
      )

      // await taskService.recalculateProfiling(userId)

      const user3 = await userService.getUser(userId)
      expect(user3.score).toHaveLength(8)
      expect(user3.classifications).toHaveLength(2)

      // three sets of tasks completed
      const tasks3 = await createUserTasks(user)
      await Promise.all(
        tasks3.map(
          async ({ task, userTask }) => await completeUserTask(task, userTask)
        )
      )

      // await taskService.recalculateProfiling(userId)

      const user4 = await userService.getUser(userId)
      expect(user4.score).toHaveLength(12)
      expect(user4.classifications).toHaveLength(3)
      expect(user4.classifications[0].classification).toBe(
        ClassificationType.Rover
      )
    },
    100 * 1000
  )
})

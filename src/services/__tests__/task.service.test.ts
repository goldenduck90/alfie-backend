import { initializeCollection } from "../../database/initializeCollection"
import AnswerType from "../../schema/enums/AnswerType"
import { Task, TaskModel, TaskType } from "../../schema/task.schema"
import { UserAnswerTypes, UserTask } from "../../schema/task.user.schema"
import {
  Classification,
  ClassificationType,
  Score,
  User,
} from "../../schema/user.schema"
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

      jest.spyOn(taskService, "handleIsReadyForProfiling")

      await taskService.recalculateProfiling(userId)
      const user1 = await userService.getUser(userId)

      // tasks assigned but not completed
      expect(user1.score).toHaveLength(0)
      expect(user1.classifications).toHaveLength(0)

      await Promise.all(
        tasks.map(
          async ({ task, userTask }) => await completeUserTask(task, userTask)
        )
      )

      // one set of tasks completed
      await taskService.recalculateProfiling(userId)
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

      await taskService.recalculateProfiling(userId)

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

      await taskService.recalculateProfiling(userId)

      const user4 = await userService.getUser(userId)
      expect(user4.score).toHaveLength(12)
      expect(user4.classifications).toHaveLength(3)
      expect(user4.classifications[0].classification).toBe(
        ClassificationType.Rover
      )
    },
    100 * 1000
  )

  test(
    "handleIsReadyForProfiling",
    async () => {
      const date = new Date(2023, 5, 5)
      const classifySpy = jest
        .spyOn(taskService, "classifySinglePatient")
        .mockImplementation(async () => [
          {
            date,
            classification: ClassificationType.Rover,
            percentile: 80,
            calculatedPercentile: 80,
          } as Classification,
        ])
      const scorePatientSpy = jest
        .spyOn(taskService, "scorePatient")
        .mockImplementation(async () => [
          {
            date,
            percentile: 80,
            calculatedPercentile: 80,
            message: "Test",
            task: TaskType.AD_LIBITUM,
            latest: "10",
          } as Score,
        ])

      const user = await createTestUser()
      const tasks = await createUserTasks(user)

      expect(classifySpy).not.toHaveBeenCalled()
      expect(scorePatientSpy).not.toHaveBeenCalled()

      // one completed task
      await completeUserTask(tasks[0].task, tasks[0].userTask)

      expect(classifySpy).not.toHaveBeenCalled()
      expect(scorePatientSpy).not.toHaveBeenCalled()

      // four completed tasks
      await completeUserTask(tasks[1].task, tasks[1].userTask)
      await completeUserTask(tasks[2].task, tasks[2].userTask)

      await completeUserTask(tasks[3].task, tasks[3].userTask)

      expect(scorePatientSpy).toHaveBeenCalledTimes(1)
      expect(classifySpy).toHaveBeenCalledTimes(1)
      expect(classifySpy).toHaveBeenCalledWith(user._id.toString())
    },
    100 * 1000
  )
})

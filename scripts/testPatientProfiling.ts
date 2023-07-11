import runShell, { createProgram } from "./utils/runShell"
import TaskService from "../src/services/task.service"
import UserService from "../src/services/user.service"
import { TaskType } from "../src/schema/task.schema"
import { UserTask, UserTaskModel } from "../src/schema/task.user.schema"
import AnswerType from "../src/schema/enums/AnswerType"
import { mpFeelingQuestions } from "../src/PROAnalysis/questions"
import mockEmails from "./utils/mockEmails"

const program = createProgram()
  .description(
    "Tests profiling patients from four completed MP_HUNGER, MP_FEELING, MP_ACTIVITY and AD_LIBITUM tasks."
  )
  .option(
    "--user <userId>",
    "The user ID to use for profiling.",
    "64929ce0870675c37050f99a"
  )
  .option(
    "--delete-user-tasks",
    "Whether to delete all user tasks before starting."
  )
  .parse()

const { user: userId, deleteUserTasks } = program.opts<{
  deleteUserTasks: boolean
  user: string
}>()

async function testPatientProfiling() {
  mockEmails()

  const userService = new UserService()
  const taskService = new TaskService()

  const user = await userService.getUser(userId)

  if (deleteUserTasks) {
    user.score = []
    user.classifications = []
    await user.save()

    await UserTaskModel.deleteMany({ user: user._id })
  }

  console.log(
    `User classifications before: ${JSON.stringify(user.classifications)}`
  )
  console.log(`User scores before: ${JSON.stringify(user.score)}`)

  const taskTypes = [
    TaskType.MP_HUNGER,
    TaskType.MP_FEELING,
    TaskType.MP_ACTIVITY,
    TaskType.AD_LIBITUM,
  ]
  const userTasks = new Map<TaskType, UserTask>()

  for (const taskType of taskTypes) {
    const userTask = await taskService.assignTaskToUser({
      taskType,
      userId: user._id.toString(),
    })
    userTasks.set(taskType, userTask)
  }

  await taskService.completeUserTask({
    _id: userTasks.get(TaskType.MP_HUNGER)?._id.toString(),
    answers: [
      { key: "foodEaten", type: AnswerType.STRING, value: "Unknown" },
      {
        key: "hungerLevel30Mins",
        type: AnswerType.NUMBER,
        value: Math.round(Math.random() * 100),
      },
      {
        key: "hungerLevel1Hour",
        type: AnswerType.NUMBER,
        value: Math.round(Math.random() * 100),
      },
    ],
  })

  const randomFeelingAnswer = (key: string): string => {
    const answers: string[] = Object.keys(mpFeelingQuestions[key])
    return answers[Math.floor(Math.random() * answers.length)]
  }

  await taskService.completeUserTask({
    _id: userTasks.get(TaskType.MP_FEELING)?._id.toString(),
    answers: [
      "tenseLevel",
      "frightenedLevel",
      "worryAmount",
      "easeFrequency",
      "frightenedFrequency",
      "restlessAmount",
      "panicFrequency",
    ].map((key) => ({
      key,
      type: AnswerType.STRING,
      value: randomFeelingAnswer(key),
    })),
  })

  await taskService.completeUserTask({
    _id: userTasks.get(TaskType.MP_ACTIVITY)?._id.toString(),
    answers: [
      {
        key: "stepsPerDay",
        type: AnswerType.NUMBER,
        value: 4000 + Math.round(Math.random() * 4000),
      },
    ],
  })

  await taskService.completeUserTask({
    _id: userTasks.get(TaskType.AD_LIBITUM)?._id.toString(),
    answers: [
      {
        key: "calories",
        type: AnswerType.NUMBER,
        value: 700 + Math.round(Math.random() * 400),
      },
    ],
  })

  const updatedTasks = await UserTaskModel.find({
    _id: { $in: Array.from(userTasks.values()).map(({ _id }) => _id) },
  })
  console.log(`Updated tasks: ${JSON.stringify(updatedTasks, null, "  ")}`)

  const updatedUser = await userService.getUser(userId)
  console.log(
    `User classifications after: ${JSON.stringify(updatedUser.classifications)}`
  )
  console.log(`User scores after: ${JSON.stringify(updatedUser.score)}`)
}

runShell(() => testPatientProfiling())

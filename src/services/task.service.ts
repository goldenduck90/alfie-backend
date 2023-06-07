import * as Sentry from "@sentry/node"
import { ApolloError } from "apollo-server"
import config from "config"
import dayjs from "dayjs"
import { addDays, isPast } from "date-fns"
import { calculateScore } from "../PROAnalysis"
import { ProviderModel } from "../schema/provider.schema"
import {
  CreateTaskInput,
  Task,
  TaskModel,
  TaskType,
} from "../schema/task.schema"
import {
  CompleteUserTaskInput,
  CreateUserTaskInput,
  CreateUserTasksInput,
  GetUserTasksInput,
  UpdateUserTaskInput,
  UserNumberAnswer,
  UserStringAnswer,
  UserTask,
  UserTaskModel,
} from "../schema/task.user.schema"
import { UserModel } from "../schema/user.schema"
import { AnswerType } from "../schema/enums/AnswerType"
import AkuteService from "./akute.service"
import { classifyUser } from "../PROAnalysis/classification"
import { calculatePatientScores } from "../scripts/calculatePatientScores"
import EmailService from "./email.service"

class TaskService {
  private akuteService: AkuteService
  private emailService: EmailService

  constructor() {
    this.akuteService = new AkuteService()
    this.emailService = new EmailService()
  }

  async createTask(input: CreateTaskInput) {
    const task = await TaskModel.create(input)
    return task
  }

  async getTask(id: string) {
    const task = await TaskModel.findById(id)
    return task
  }

  async getUserTask(id: string, userId?: string) {
    const { notFound, notPermitted } = config.get("errors.tasks") as any
    const userTask = await UserTaskModel.findById(id).populate("task")
    if (!userTask) {
      throw new ApolloError(notFound.message, notFound.code)
    }

    if (!userTask.task) {
      throw new ApolloError(notFound.message, notFound.code)
    }

    if (userId && userTask.user.toString() !== userId) {
      throw new ApolloError(notPermitted.message, notPermitted.code)
    }

    return userTask
  }

  async getUserTasks(userId: string, input: GetUserTasksInput) {
    const { limit, offset, completed } = input
    const { noTasks } = config.get("errors.tasks") as any
    const where = { ...(completed !== undefined && { completed }) }

    const userTasksCount = await UserTaskModel.find({
      user: userId,
    })
      .where(where)
      .countDocuments()
    if (userTasksCount === 0) {
      throw new ApolloError(noTasks.message, noTasks.code)
    }

    const userTasks = await UserTaskModel.find({ user: userId })
      .where(where)
      .skip(offset)
      .limit(limit)
      .sort({ highPriority: -1, dueAt: -1, createdAt: 1 })
      .populate("task")
      .populate("user")
    return {
      total: userTasksCount,
      limit,
      offset,
      userTasks: userTasks
        .filter((u) => u.task)
        .map((userTask) => ({
          ...userTask.toObject(),
          ...(userTask.dueAt && { pastDue: isPast(userTask.dueAt) }),
        })),
    }
  }
  async checkEligibilityForAppointment(userId: any) {
    try {
      const userTasks: any = await UserTaskModel.find({
        user: userId,
      }).populate("task")
      const requiredTaskTypes = [
        TaskType.MP_HUNGER,
        TaskType.MP_FEELING,
        TaskType.AD_LIBITUM,
        TaskType.MP_ACTIVITY,
      ]
      const completedTasks: any = userTasks.filter(
        (task: any) => task.completed
      )
      const completedTaskTypes = completedTasks.map(
        (task: any) => task.task.type
      )

      const hasCompletedRequiredTasks = requiredTaskTypes.every((taskType) =>
        completedTaskTypes.includes(taskType)
      )
      const hasScheduledAppointmentTask = userTasks.some(
        (task: any) =>
          task.task === TaskType.SCHEDULE_APPOINTMENT && !task.completed
      )
      if (hasCompletedRequiredTasks && !hasScheduledAppointmentTask) {
        const newTaskInput = {
          taskType: TaskType.SCHEDULE_APPOINTMENT,
          userId: userId.toString(),
        }
        await this.assignTaskToUser(newTaskInput)
      }
    } catch (error) {
      Sentry.captureException(error)
    }
  }

  async handleIsReadyForProfiling(
    userId: any,
    scores: any,
    currentTask: any,
    originalTaskProfilingStatus: boolean
  ) {
    try {
      const userTasks: any = await UserTaskModel.find({
        user: userId,
      }).populate("task")

      const user: any = await UserModel.find({
        _id: userId,
      })

      const userScores = scores

      const tasksEligibleForProfiling = [
        TaskType.MP_HUNGER,
        TaskType.MP_FEELING,
        TaskType.AD_LIBITUM,
        TaskType.MP_ACTIVITY,
      ]

      console.log(userTasks, "userTasks")

      const completedTasks = userTasks.filter(
        ({
          task,
          isReadyForProfiling,
          completed,
        }: {
          task: any
          isReadyForProfiling: any
          completed: any
        }) =>
          (tasksEligibleForProfiling.includes(task.type) ||
            task._id === currentTask._id) &&
          isReadyForProfiling &&
          completed
      )

      // If the currentTask has not been considered in the completedTasks, add it manually.
      if (
        currentTask &&
        originalTaskProfilingStatus &&
        !completedTasks.some((task: any) => task._id === currentTask._id)
      ) {
        completedTasks.push(currentTask)
      }

      if (
        userScores.length === 0 &&
        completedTasks.length >= tasksEligibleForProfiling.length
      ) {
        const newScores = await this.scorePatient(userId)
        user.score = newScores
        await user.save()
        await this.classifySinglePatient(userId)
        // set those tasks to not ready for profiling
        for (const task of completedTasks) {
          const userTask = await UserTaskModel.findById(task._id)
          userTask.isReadyForProfiling = false
          await userTask.save()
        }
      } else if (
        userScores.length > 0 &&
        completedTasks.length >= tasksEligibleForProfiling.length
      ) {
        await this.classifySinglePatient(userId)
        for (const task of completedTasks) {
          const userTask = await UserTaskModel.findById(task._id)
          userTask.isReadyForProfiling = false
          await userTask.save()
        }
      } else {
        console.log("not ready for profiling")
      }
    } catch (error) {
      Sentry.captureException(error)
    }
  }

  async scorePatient(userId: string) {
    try {
      const scores = await calculatePatientScores(userId)
      return scores
    } catch (error) {
      Sentry.captureException(error)
    }
  }
  async classifyPatient(userId: string) {
    try {
      console.log(userId) // TODO: classify specific patient
      const users = await UserModel.find()

      for (const user of users) {
        if (user.score.length > 0 && user.score[0] !== null) {
          const scoresByTask = new Map()

          // group scores by task
          for (const score of user.score) {
            if (!scoresByTask.has(score.task)) {
              scoresByTask.set(score.task, [])
            }
            scoresByTask.get(score.task).push(score)
          }

          const scores = []

          // get most recent score for each task
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          for (const [_, taskScores] of scoresByTask) {
            const mostRecentScore = taskScores.sort(
              (a: any, b: any) =>
                new Date(b.date).getTime() - new Date(a.date).getTime()
            )[0]
            scores.push(mostRecentScore)
          }

          const classifications: any = classifyUser(scores)

          for (const c of classifications) {
            const classificationExists = user.classifications.some(
              (el: any) => el.date === c.date
            )

            if (!classificationExists) {
              user.classifications.push(c)
            }
          }

          await user.save()
        }
      }
    } catch (error) {
      console.log(error, "error")
      Sentry.captureException(error)
    }
  }

  async classifySinglePatient(userId: string) {
    try {
      console.log(userId) // TODO: classify specific patient
      const user = await UserModel.findById(userId)

      if (user && user.score.length > 0 && user.score[0] !== null) {
        const scoresByTask = new Map()

        // group scores by task
        for (const score of user.score) {
          if (!scoresByTask.has(score.task)) {
            scoresByTask.set(score.task, [])
          }
          scoresByTask.get(score.task).push(score)
        }

        const scores = []

        // get most recent score for each task
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for (const [_, taskScores] of scoresByTask) {
          const mostRecentScore = taskScores.sort(
            (a: any, b: any) =>
              new Date(b.date).getTime() - new Date(a.date).getTime()
          )[0]
          scores.push(mostRecentScore)
        }

        const classifications: any = classifyUser(scores)

        for (const c of classifications) {
          const classificationExists = user.classifications.some(
            (el: any) => el.date === c.date
          )

          if (!classificationExists) {
            user.classifications.push(c)
          }
        }

        await user.save()
        return classifications
      }
    } catch (error) {
      console.log(error, "error")
      Sentry.captureException(error)
    }
  }

  async completeUserTask(input: CompleteUserTaskInput) {
    try {
      // Get the user task, throw an error if it is not found
      const { notFound } = config.get("errors.tasks") as any
      const { _id, answers } = input
      console.log("input", input)
      console.log("answers", answers)
      const userTask = await UserTaskModel.findById(_id)
      if (!userTask) {
        throw new ApolloError(notFound.message, notFound.code)
      }

      console.log("userTask", userTask)
      // Get the user and task documents
      const user = await UserModel.findById(userTask.user)
      const task = await TaskModel.findById(userTask.task)
      // Mark the user task as completed and save it
      userTask.completed = true
      userTask.completedAt = new Date()
      userTask.answers = []
      userTask.answers = answers
      await userTask.save()
      const lastTask = await UserTaskModel.findOne({
        user: userTask.user,
        task: userTask.task,
      })
        .sort({ createdAt: -1 })
        .skip(1)
      // Check the user's eligibility for an appointment
      await this.checkEligibilityForAppointment(userTask.user)

      // Calculate the score for the user based on their previous and current tasks

      const scores = user?.score
      if (lastTask && task.type !== TaskType.NEW_PATIENT_INTAKE_FORM) {
        const score = calculateScore(lastTask, userTask, task.type)
        // push score to user score array
        if (score !== null) {
          scores.push(score)
          user.score.push(score)
          await user.save()
        }
      }
      const tasksEligibleForProfiling = [
        TaskType.MP_HUNGER,
        TaskType.MP_FEELING,
        TaskType.AD_LIBITUM,
        TaskType.MP_ACTIVITY,
      ]
      // if the tasktype is eligible for profiling, check if the user is ready for profiling and set the userTask.isReadyForProfiling to true
      if (tasksEligibleForProfiling.includes(task.type)) {
        userTask.isReadyForProfiling = true
        await userTask.save()
        await this.handleIsReadyForProfiling(
          userTask.user,
          scores,
          task,
          userTask.isReadyForProfiling
        )
      }

      // Handle different task types
      switch (task.type) {
        case TaskType.MP_BLUE_CAPSULE: {
          // Assign the next task to the user
          const newTaskInput: CreateUserTaskInput = {
            taskType: TaskType.MP_BLUE_CAPSULE_2,
            userId: userTask.user.toString(),
          }
          await this.assignTaskToUser(newTaskInput)
          break
        }
        case TaskType.DAILY_METRICS_LOG: {
          const weight = {
            date: new Date(),
            value: (
              answers.find((a) => a.key === "weightInLbs") as UserNumberAnswer
            ).value,
          }
          user.weights.push(weight)
          await user.save()
          break
        }
        case TaskType.NEW_PATIENT_INTAKE_FORM: {
          const pharmacyAnswer = answers.find(
            (a) => a.key === "pharmacyLocation"
          ) as UserStringAnswer
          const pharmacyId = pharmacyAnswer.value
          const patientId = user?.akutePatientId
          if (pharmacyId !== "null") {
            await this.akuteService.createPharmacyListForPatient(
              pharmacyId,
              patientId,
              true
            )
            user.pharmacyLocation = pharmacyId
          }

          // const hasRequiredLabs = answers.find(
          //   (a) => a.key === "hasRequiredLabs"
          // )

          await user.save()
          break
        }
        case TaskType.WEIGHT_LOG: {
          const weight = {
            date: new Date(),
            value: (answers.find((a) => a.key === "weight") as UserNumberAnswer)
              .value,
          }
          const bmi =
            (weight.value / user.heightInInches / user.heightInInches) *
            703.071720346
          user.weights.push(weight)
          user.bmi = bmi
          await user.save()
          break
        }
        default: {
          // Do nothing
          break
        }
      }
      return {
        ...userTask.toObject(),
      }
    } catch (error) {
      console.log(error, "error")
      console.error(error)
      Sentry.captureException(error)
      throw error
    }
  }
  async bulkAssignTasksToUser(input: CreateUserTasksInput) {
    try {
      const { alreadyAssigned, notFound, userNotFound } = config.get(
        "errors.tasks"
      ) as any
      const { userId, taskTypes } = input
      const user = await UserModel.findById(userId)
      if (!user) {
        throw new ApolloError(userNotFound.message, userNotFound.code)
      }

      const tasks = await TaskModel.find({ type: { $in: taskTypes } }).where({
        completed: false,
      })
      if (tasks.length !== taskTypes.length) {
        throw new ApolloError(notFound.message, notFound.code)
      }
      const taskIds = tasks.map((task) => task._id)

      const userTasks = await UserTaskModel.find({
        user: userId,
        task: { $in: taskIds },
      })

      const newTasks: Omit<UserTask, "_id" | "completed">[] = tasks.reduce(
        (filtered: Omit<UserTask, "_id" | "completed">[], task) => {
          const existingTask = userTasks.find(
            (userTask) => userTask.task.toString() === task._id.toString()
          )

          if (!existingTask || (existingTask && task.canHaveMultiple)) {
            filtered.push({
              user: userId,
              task: task._id,
              ...(task.daysTillDue && {
                dueAt: addDays(new Date(), task.daysTillDue),
              }),
              highPriority: task.highPriority,
              lastNotifiedUserAt: task.notifyWhenAssigned
                ? new Date()
                : undefined,
              archived: false,
              isReadyForProfiling: false,
            })
          }

          return filtered
        },
        []
      )
      if (!newTasks.length) {
        throw new ApolloError(alreadyAssigned.message, alreadyAssigned.code)
      }

      const newUserTasks = await UserTaskModel.create(newTasks)

      return newUserTasks.map((userTask) => ({
        ...userTask.toObject(),
        ...(userTask.dueAt && { pastDue: false }),
      }))
    } catch (error) {
      console.log(error, "error in bulkAssignTasksToUser")
      Sentry.captureException(error)
    }
  }

  async assignTaskToUser(input: CreateUserTaskInput) {
    const { alreadyAssigned, notFound, userNotFound } = config.get(
      "errors.tasks"
    ) as any
    const { userId, taskType } = input

    const task = await TaskModel.find().findByType(taskType)
    if (!task) {
      throw new ApolloError(notFound.message, notFound.code)
    }

    const existingUserTask = await UserTaskModel.find().findUserTask(
      userId,
      task._id
    )
    if (
      existingUserTask &&
      !task.canHaveMultiple &&
      !existingUserTask.completed
    ) {
      throw new ApolloError(alreadyAssigned.message, alreadyAssigned.code)
    }

    const user = await UserModel.findById(userId)
    if (!user) {
      throw new ApolloError(userNotFound.message, userNotFound.code)
    }

    const newTask = await UserTaskModel.create({
      user: userId,
      task: task._id,
      dueAt: task.daysTillDue
        ? addDays(new Date(), task.daysTillDue)
        : undefined,
      highPriority: task.highPriority,
      lastNotifiedUserAt: task.notifyWhenAssigned ? new Date() : undefined,
    })

    await newTask.populate("user")
    await newTask.populate("task")

    if (task.notifyWhenAssigned) {
      await this.emailService.sendTaskAssignedEmail({
        email: user.email,
        taskName: task.name,
        taskId: newTask._id,
        taskType: task.type,
        dueAt: newTask.dueAt,
      })
    }

    return {
      ...newTask.toObject(),
      ...(newTask.dueAt && { pastDue: false }),
    }
  }
  async getAllTasks() {
    try {
      const tasks = await TaskModel.find()
      return tasks
    } catch (error) {
      Sentry.captureException(error)
      throw new ApolloError(error.message, error.code)
    }
  }
  async getAllUserTasks() {
    try {
      const userTasks = await UserTaskModel.find()
      return userTasks
    } catch (error) {
      Sentry.captureException(error)
      throw new ApolloError(error.message, error.code)
    }
  }
  async getAllUserTasksByUserId(userId: string) {
    try {
      const userTasks: any = await UserTaskModel.find({ user: userId })
        .populate("task")
        .populate("user")
      const providerId = userTasks[0]?.user.provider.toHexString()
      const lookUpProviderEmail = await ProviderModel.findOne({
        _id: providerId,
      })
      const arrayOfUserTasksWithProviderEmail = userTasks.map((task: any) => {
        return {
          ...task.toObject(),
          providerEmail: lookUpProviderEmail.email,
        }
      })
      return arrayOfUserTasksWithProviderEmail
    } catch (error) {
      Sentry.captureException(error)
      throw new ApolloError(error.message, "ERROR")
    }
  }
  async archiveTask(taskId: string) {
    try {
      const task = await UserTaskModel.findById(taskId)
      if (!task) {
        throw new ApolloError("Task not found", "404")
      }
      task.archived = true
      await task.save()
      return task
    } catch (error) {
      Sentry.captureException(error)
      throw new ApolloError(error.message, error.code)
    }
  }
  async updateTask(taskId: string, input: UpdateUserTaskInput) {
    try {
      const task = await UserTaskModel.findById(taskId)
      if (!task) {
        throw new ApolloError("Task not found", "404")
      }
      const { lastNotifiedUserAt } = input
      task.lastNotifiedUserAt = lastNotifiedUserAt
      await task.save()
      return task
    } catch (error) {
      Sentry.captureException(error)
      throw new ApolloError(error.message, error.code)
    }
  }

  /**
   * Converts answers in UserTask.answers to the correct format specified in Task.questions, if present.
   */
  async cleanupUserTaskAnswersFromTaskQuestions(
    /** Whether to log but not execute changes that would be made. */
    preview = true
  ) {
    if (preview) {
      console.log("Preview mode.")
    }
    const tasks = await this.getAllTasks()
    const tasksById: Record<string, Task> = tasks.reduce(
      (map, task) => ({ ...map, [task._id.toString()]: task }),
      {}
    )
    const userTasks = await this.getAllUserTasks()
    console.log(`Tasks: ${JSON.stringify(tasksById, null, "  ")}`)

    for (const userTask of userTasks) {
      const task = tasksById[userTask.task?.toString()]
      if (!task) {
        console.log(`No corresponding task for UserTask.task ${userTask.task}`)
        continue
      }

      const { answers } = userTask
      const { questions } = task
      if (questions && answers) {
        answers.forEach((answer, answerIndex) => {
          const question = questions.find((q) => q.key === answer.key)
          if (question) {
            const originalAnswerType = answer.type
            const originalAnswerValue = answer.value
            answer.type = question.type as any

            // cast or convert answer.value except for files, strings and arrays,
            // which are all stored as strings
            switch (question.type) {
              case AnswerType.BOOLEAN:
                answer.value =
                  typeof answer.value === "boolean"
                    ? answer.value
                    : /true|yes|on|t|1/i.test(`${answer.value}`)
                break
              case AnswerType.NUMBER: {
                const asNumber = Number(answer.value)
                if (Number.isFinite(asNumber)) {
                  answer.value = Number.isFinite(asNumber)
                } else {
                  const asNumbers = String(answer.value)
                    .split(/[^0-9]/)
                    .map((s) => Number(s.trim()))
                    .filter((n) => Number.isFinite(n))
                  const sum = asNumbers.reduce((memo, v) => memo + v, 0)
                  const average = sum / asNumbers.length
                  answer.value = average
                }
                break
              }
              case AnswerType.DATE:
                answer.value = dayjs(answer.value as any).toISOString()
                break
            }

            if (answer.type !== originalAnswerType) {
              console.log(
                `* Change ${userTask._id.toString()} answer [${answerIndex}] type from ${originalAnswerType} to ${
                  answer.type
                }`
              )
            }
            if (answer.value !== originalAnswerValue) {
              console.log(
                `* Change ${userTask._id.toString()} answer [${answerIndex}] value from ${originalAnswerValue} to ${
                  answer.value
                }`
              )
            }
          } else {
            console.log(`No corresponding question for answer ${answer.key}`)
          }
        })
      }
    }
  }
}

export default TaskService

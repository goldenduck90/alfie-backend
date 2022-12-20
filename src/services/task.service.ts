import * as Sentry from "@sentry/node"
import { ApolloError } from "apollo-server"
import config from "config"
import { addDays, isPast } from "date-fns"
import { calculateScore } from "../PROAnalysis"
import { LabModel } from "../schema/lab.schema"
import { ProviderModel } from "../schema/provider.schema"
import { CreateTaskInput, TaskModel, TaskType } from "../schema/task.schema"
import {
  CompleteUserTaskInput,
  CreateUserTaskInput,
  CreateUserTasksInput,
  GetUserTasksInput,
  UpdateUserTaskInput,
  UserTask,
  UserTaskModel,
} from "../schema/task.user.schema"
import { UserModel } from "../schema/user.schema"
import AkuteService from "./akute.service"
import EmailService from "./email.service"
import FaxService from "./fax.service"
import PDFService from "./pdf.service"
const akuteService = new AkuteService()

class TaskService extends EmailService {
  private pdfService: PDFService
  private faxService: FaxService

  constructor() {
    super()
    this.pdfService = new PDFService()
    this.faxService = new FaxService()
  }

  async createTask(input: CreateTaskInput) {
    const { name, type, interval } = input

    const task = await TaskModel.create({
      name,
      type,
      interval,
    })

    return task
  }

  async getTask(id: string) {
    const task = await TaskModel.findById(id)
    return task
  }

  async getUserTask(id: string, userId?: string) {
    const { notFound, notPermitted } = config.get("errors.tasks") as any
    const userTask = await UserTaskModel.findById(id)
    if (!userTask) {
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
      userTasks: userTasks.map((userTask) => ({
        ...userTask.toObject(),
        ...(userTask.dueAt && { pastDue: isPast(userTask.dueAt) }),
      })),
    }
  }
  async checkEligibilityForAppointment(userId: any) {
    try {
      // Get all user tasks userId
      const userTasks = await UserTaskModel.find({ user: userId }).populate(
        "task"
      )
      // once I have all the tasks review and see if the user has completed all the required tasks in this array
      const requiredTasks = [
        // TaskType.MP_BLUE_CAPSULE,
        // TaskType.MP_BLUE_CAPSULE_2,
        TaskType.MP_HUNGER,
        TaskType.MP_FEELING,
        TaskType.AD_LIBITUM,
        TaskType.GSRS,
        TaskType.TEFQ,
      ]
      const completedTasks: any = userTasks.filter((task) => task.completed)
      const completedTaskTypes = completedTasks.map(
        (task: any) => task.task.type
      )
      const hasCompletedRequiredTasks = requiredTasks.every((task) =>
        completedTaskTypes.includes(task)
      )
      // If the user already has a schedule appointment task, do not create a new one
      const unCompletedTasks = userTasks.filter((task) => !task.completed)
      const unCompletedTaskTypes = unCompletedTasks.map(
        (task: any) => task.task.type
      )
      const hasScheduledAppointmentTask = unCompletedTaskTypes.includes(
        TaskType.SCHEDULE_APPOINTMENT
      )

      if (hasCompletedRequiredTasks === true && !hasScheduledAppointmentTask) {
        const newTaskInput: CreateUserTaskInput = {
          taskType: TaskType.SCHEDULE_APPOINTMENT,
          userId: userId.toString(),
        }
        await this.assignTaskToUser(newTaskInput)
      }
    } catch (error) {
      Sentry.captureException(error)
    }
  }

  // async completeUserTask(input: CompleteUserTaskInput) {
  //   const { notFound } = config.get("errors.tasks") as any
  //   const { _id, answers } = input
  //   const userTask = await UserTaskModel.findById(_id)
  //   if (!userTask) {
  //     throw new ApolloError(notFound.message, notFound.code)
  //   }
  //   await this.checkEligibilityForAppointment(userTask.user)
  //   const user = await UserModel.findById(userTask.user)
  //   const task = await TaskModel.findById(userTask.task)
  //   userTask.completed = true
  //   userTask.completedAt = new Date()
  //   userTask.answers = answers
  //   const lastTask = await UserTaskModel.findOne({
  //     user: userTask.user,
  //     task: userTask.task,
  //   })
  //     .sort({ createdAt: -1 })
  //     .skip(1)
  //   const score = calculateScore(
  //     lastTask,
  //     userTask,
  //     task.type
  //   )
  //   user.score.push(score)
  //   await userTask.save()
  //   // we can add more types here in a switch to save data to different places

  //   // if the task type is MP_BLUE_CAPSULE we need to assign the user the next task which is MP_BLUE_CAPSULE_2
  //   if (task.type === TaskType.LAB_SELECTION) {
  //     const labId = answers.find((a) => a.key === "labCorpLocation").value
  //     user.labLocation = labId
  //     const hasRequiredLabs = answers.find((a) => a.key === "hasRequiredLabs")
  //     if (hasRequiredLabs && hasRequiredLabs.value === "true") {
  //       const newTaskInput: CreateUserTaskInput = {
  //         taskType: TaskType.SCHEDULE_APPOINTMENT,
  //         userId: userTask.user.toString(),
  //       }
  //       await this.assignTaskToUser(newTaskInput)
  //     } else {
  //       try {
  //         // get user provider
  //         const provider = await ProviderModel.findById(user.provider)

  //         // get labcorp location fax number
  //         const locationId = answers.find(
  //           (a) => a.key === "labCorpLocation"
  //         ).value
  //         const labCorpLocation = await LabModel.findById(locationId)
  //         const faxNumber = labCorpLocation.faxNumber

  //         // calculate bmi
  //         const bmi =
  //           (user.weights[0].value /
  //             user.heightInInches /
  //             user.heightInInches) *
  //           703.071720346

  //         // create pdf
  //         const pdfBuffer = await this.pdfService.createLabOrderPdf({
  //           patientFullName: user.name,
  //           providerFullName: `${provider.firstName} ${provider.lastName}`,
  //           providerNpi: provider.npi,
  //           patientDob: user.dateOfBirth,
  //           icdCode: 27 < bmi && bmi < 30 ? "E66.3" : "E66.9",
  //         })

  //         // send fax to labcorp location
  //         const faxResult = await this.faxService.sendFax({
  //           faxNumber,
  //           pdfBuffer,
  //         })
  //         console.log(faxResult, `faxResult for user: ${user.id}`)
  //         Sentry.captureMessage(
  //           `faxResult: ${JSON.stringify(faxResult)} for user: ${user.id}`
  //         )
  //       } catch (error) {
  //         console.log(`error with faxResult for user: ${user.id}`, error)
  //         Sentry.captureException(error, {
  //           tags: {
  //             userId: user.id,
  //             patientId: user.akutePatientId,
  //           },
  //         })
  //       }
  //       await user.save()
  //     }
  //   }
  //   // if (task.type === TaskType.MP_BLUE_CAPSULE) {
  //   //   const newTaskInput: CreateUserTaskInput = {
  //   //     taskType: TaskType.MP_BLUE_CAPSULE_2,
  //   //     userId: userTask.user.toString(),
  //   //   }
  //   //   await this.assignTaskToUser(newTaskInput)
  //   // }
  //   if (task.type === TaskType.DAILY_METRICS_LOG) {
  //     const weight = {
  //       date: new Date(),
  //       value: answers.find((a) => a.key === "weightInLbs").value,
  //     }

  //     user.weights.push(weight)
  //     await user.save()
  //   }
  //   if (task.type === TaskType.NEW_PATIENT_INTAKE_FORM) {
  //     const pharmacyId = answers.find((a) => a.key === "pharmacyLocation").value
  //     const patientId = user?.akutePatientId
  //     if (pharmacyId !== "null") {
  //       await akuteService.createPharmacyListForPatient(
  //         pharmacyId,
  //         patientId,
  //         true
  //       )
  //       user.pharmacyLocation = pharmacyId
  //     }
  //     const labId = answers.find((a) => a.key === "labCorpLocation").value
  //     user.labLocation = labId
  //     const hasRequiredLabs = answers.find((a) => a.key === "hasRequiredLabs")
  //     if (hasRequiredLabs && hasRequiredLabs.value === "true") {
  //       const newTaskInput: CreateUserTaskInput = {
  //         taskType: TaskType.SCHEDULE_APPOINTMENT,
  //         userId: userTask.user.toString(),
  //       }
  //       await this.assignTaskToUser(newTaskInput)
  //     } else {
  //       try {
  //         // get user provider
  //         const provider = await ProviderModel.findById(user.provider)

  //         // get labcorp location fax number
  //         const locationId = answers.find(
  //           (a) => a.key === "labCorpLocation"
  //         ).value
  //         const labCorpLocation = await LabModel.findById(locationId)
  //         const faxNumber = labCorpLocation.faxNumber

  //         // calculate bmi
  //         const bmi =
  //           (user.weights[0].value /
  //             user.heightInInches /
  //             user.heightInInches) *
  //           703.071720346

  //         // create pdf
  //         const pdfBuffer = await this.pdfService.createLabOrderPdf({
  //           patientFullName: user.name,
  //           providerFullName: `${provider.firstName} ${provider.lastName}`,
  //           providerNpi: provider.npi,
  //           patientDob: user.dateOfBirth,
  //           icdCode: 27 < bmi && bmi < 30 ? "E66.3" : "E66.9",
  //         })

  //         // send fax to labcorp location
  //         const faxResult = await this.faxService.sendFax({
  //           faxNumber,
  //           pdfBuffer,
  //         })

  //         console.log(faxResult, `faxResult for user: ${user.id}`)
  //         Sentry.captureMessage(
  //           `faxResult: ${JSON.stringify(faxResult)} for user: ${user.id}`
  //         )
  //       } catch (error) {
  //         console.log(`error with faxResult for user: ${user.id}`, error)
  //         Sentry.captureException(error, {
  //           tags: {
  //             userId: user.id,
  //             patientId: user.akutePatientId,
  //           },
  //         })
  //       }
  //     }

  //     await user.save()
  //   }

  //   return {
  //     ...userTask.toObject(),
  //   }
  // }
  async completeUserTask(input: CompleteUserTaskInput) {
    try {
      // Get the user task, throw an error if it is not found
      const { notFound } = config.get("errors.tasks") as any
      const { _id, answers } = input
      const userTask = await UserTaskModel.findById(_id)
      if (!userTask) {
        throw new ApolloError(notFound.message, notFound.code)
      }

      // Check the user's eligibility for an appointment
      await this.checkEligibilityForAppointment(userTask.user)

      // Get the user and task documents
      const user = await UserModel.findById(userTask.user)
      const task = await TaskModel.findById(userTask.task)

      // Mark the user task as completed and save it
      userTask.completed = false
      userTask.completedAt = new Date()
      userTask.answers = answers
      await userTask.save()

      // Calculate the score for the user based on their previous and current tasks
      const lastTask = await UserTaskModel.findOne({
        user: userTask.user,
        task: userTask.task,
      })
        .sort({ createdAt: -1 })
        .skip(1)
      if (lastTask) {
        const score = calculateScore(lastTask, userTask, task.type)
        // push score to user score array
        user.score.push(score)
        await user.save()
      }
      // Handle different task types
      switch (task.type) {
        case TaskType.LAB_SELECTION: {
          // Update the user's lab location and assign them the next task if needed
          const labId = answers.find((a) => a.key === "labCorpLocation").value
          user.labLocation = labId
          const hasRequiredLabs = answers.find(
            (a) => a.key === "hasRequiredLabs"
          )
          if (hasRequiredLabs && hasRequiredLabs.value === "true") {
            const newTaskInput: CreateUserTaskInput = {
              taskType: TaskType.SCHEDULE_APPOINTMENT,
              userId: userTask.user.toString(),
            }
            await this.assignTaskToUser(newTaskInput)
          } else {
            // Create a lab order PDF and send it to the lab
            const provider = await ProviderModel.findById(user.provider)
            const locationId = answers.find(
              (a) => a.key === "labCorpLocation"
            ).value
            const labCorpLocation = await LabModel.findById(locationId)
            const faxNumber = labCorpLocation.faxNumber
            const bmi =
              (user.weights[0].value /
                user.heightInInches /
                user.heightInInches) *
              703.071720346
            const pdfBuffer = await this.pdfService.createLabOrderPdf({
              patientFullName: user.name,
              providerFullName: `${provider.firstName} ${provider.lastName}`,
              providerNpi: provider.npi,
              patientDob: user.dateOfBirth,
              icdCode: 27 < bmi && bmi < 30 ? "E66.3" : "E66.9",
            })
            const faxResult = await this.faxService.sendFax({
              faxNumber,
              pdfBuffer,
            })
            console.log(faxResult, `faxResult for user: ${user.id}`)
            Sentry.captureMessage(
              `faxResult: ${JSON.stringify(faxResult)} for user: ${user.id}`
            )
          }
          break
        }
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
            value: answers.find((a) => a.key === "weightInLbs").value,
          }
          user.weights.push(weight)
          await user.save()
          break
        }
        case TaskType.NEW_PATIENT_INTAKE_FORM: {
          const pharmacyId = answers.find(
            (a) => a.key === "pharmacyLocation"
          ).value
          const patientId = user?.akutePatientId
          if (pharmacyId !== "null") {
            await akuteService.createPharmacyListForPatient(
              pharmacyId,
              patientId,
              true
            )
            user.pharmacyLocation = pharmacyId
          }
          const labId = answers.find((a) => a.key === "labCorpLocation").value
          user.labLocation = labId
          const hasRequiredLabs = answers.find(
            (a) => a.key === "hasRequiredLabs"
          )
          if (hasRequiredLabs && hasRequiredLabs.value === "true") {
            const newTaskInput: CreateUserTaskInput = {
              taskType: TaskType.SCHEDULE_APPOINTMENT,
              userId: userTask.user.toString(),
            }
            await this.assignTaskToUser(newTaskInput)
          } else {
            try {
              // get user provider
              const provider = await ProviderModel.findById(user.provider)

              // get labcorp location fax number
              const locationId = answers.find(
                (a) => a.key === "labCorpLocation"
              ).value
              const labCorpLocation = await LabModel.findById(locationId)
              const faxNumber = labCorpLocation.faxNumber

              // calculate bmi
              const bmi =
                (user.weights[0].value /
                  user.heightInInches /
                  user.heightInInches) *
                703.071720346

              // create pdf
              const pdfBuffer = await this.pdfService.createLabOrderPdf({
                patientFullName: user.name,
                providerFullName: `${provider.firstName} ${provider.lastName}`,
                providerNpi: provider.npi,
                patientDob: user.dateOfBirth,
                icdCode: 27 < bmi && bmi < 30 ? "E66.3" : "E66.9",
              })

              // send fax to labcorp location
              const faxResult = await this.faxService.sendFax({
                faxNumber,
                pdfBuffer,
              })

              console.log(faxResult, `faxResult for user: ${user.id}`)
              Sentry.captureMessage(
                `faxResult: ${JSON.stringify(faxResult)} for user: ${user.id}`
              )
            } catch (error) {
              console.log(`error with faxResult for user: ${user.id}`, error)
              Sentry.captureException(error, {
                tags: {
                  userId: user.id,
                  patientId: user.akutePatientId,
                },
              })
            }
          }

          await user.save()
          break
        }
        // Add more cases here as needed
        default: {
          // Do nothing
          break
        }
      }
      return {
        ...userTask.toObject(),
      }
    } catch (error) {
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

      const tasks = await TaskModel.find({ type: { $in: taskTypes } })
        .where({ completed: false })
        .lean()
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
    }
  }

  async assignTaskToUser(input: CreateUserTaskInput) {
    const { alreadyAssigned, notFound, userNotFound } = config.get(
      "errors.tasks"
    ) as any
    const { userId, taskType } = input

    const task = await TaskModel.find().findByType(taskType).lean()
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
      await this.sendTaskAssignedEmail({
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
      console.log(tasks)
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
      // console.log(userTasks)
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
}

export default TaskService

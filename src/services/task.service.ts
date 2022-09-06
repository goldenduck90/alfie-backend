import {
  CompleteUserTaskInput,
  CreateUserTaskInput,
  CreateUserTasksInput,
  GetUserTasksInput,
  UserTask,
  UserTaskModel,
} from "../schema/task.user.schema"
import { CreateTaskInput, TaskModel } from "../schema/task.schema"
import { ApolloError } from "apollo-server"
import config from "config"
import EmailService from "./email.service"
import { UserModel } from "../schema/user.schema"
import { addDays, isPast } from "date-fns"

class TaskService extends EmailService {
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

  async completeUserTask(input: CompleteUserTaskInput) {
    const { notFound } = config.get("errors.tasks") as any
    const message = config.get("messages.taskCompleted")
    const { _id, answers } = input
    const userTask = await UserTaskModel.findById(_id)
    if (!userTask) {
      throw new ApolloError(notFound.message, notFound.code)
    }

    userTask.completed = true
    userTask.completedAt = new Date()
    userTask.answers = answers
    await userTask.save()

    return {
      message,
    }
  }

  async bulkAssignTasksToUser(input: CreateUserTasksInput) {
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
  }

  async assignTaskToUser(input: CreateUserTaskInput) {
    const { alreadyAssigned, notFound, userNotFound } = config.get(
      "errors.tasks"
    ) as any
    const { userId, taskType } = input
    const task = await TaskModel.find().findByType(taskType).lean()
    if (task) {
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
}

export default TaskService

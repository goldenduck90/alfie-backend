import {
  CompleteUserTaskInput,
  CreateUserTaskInput,
  GetUserTasksInput,
  UserTaskModel,
} from "../schema/task.user.schema"
import { CreateTaskInput, TaskModel } from "../schema/task.schema"
import { ApolloError } from "apollo-server"
import config from "config"
import EmailService from "./email.service"
import { UserModel } from "../schema/user.schema"
import { addHours, isPast } from "date-fns"

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
    const { notFound, notPermitted } = config.get("errors.tasks")
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
    const { limit, offset } = input
    const userTasks = await UserTaskModel.find({ user: userId })
      .skip(offset)
      .limit(limit)
    const userTasksCount = await UserTaskModel.find({
      user: userId,
    }).countDocuments()

    return {
      total: userTasksCount,
      limit,
      offset,
      userTasks: userTasks.map((userTask) => ({
        ...userTask,
        ...(userTask.dueAt && { pastDue: isPast(userTask.dueAt) }),
      })),
    }
  }

  async completeUserTask(input: CompleteUserTaskInput) {
    const { notFound } = config.get("errors.tasks")
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

  async assignTaskToUser(input: CreateUserTaskInput) {
    const { alreadyAssigned, notFound, userNotFound } =
      config.get("errors.tasks")
    const { userId, taskId } = input
    const existingUserTask = await UserTaskModel.find().findUserTask(
      userId,
      taskId
    )
    if (existingUserTask && !existingUserTask.completed) {
      throw new ApolloError(alreadyAssigned.message, alreadyAssigned.code)
    }

    const user = await UserModel.findById(userId)
    if (!user) {
      throw new ApolloError(userNotFound.message, userNotFound.code)
    }

    const task = await TaskModel.findById(taskId)
    if (!task) {
      throw new ApolloError(notFound.message, notFound.code)
    }

    const newTask = await UserTaskModel.create({
      user: userId,
      task: taskId,
      dueAt: task.hoursTillDue
        ? addHours(new Date(), task.hoursTillDue)
        : undefined,
    })

    await newTask.populate("user")
    await newTask.populate("task")

    if (task.notifyWhenAssigned) {
      await this.sendTaskAssignedEmail({
        email: user.email,
        taskName: task.name,
        taskId: newTask._id,
        dueAt: newTask.dueAt,
      })
    }

    return {
      ...newTask,
      ...(newTask.dueAt && { pastDue: isPast(newTask.dueAt) }),
    }
  }
}

export default TaskService

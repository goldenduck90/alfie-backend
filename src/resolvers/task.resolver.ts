import { Arg, Authorized, Ctx, Mutation, Query, Resolver } from "type-graphql"
import { Role } from "../schema/user.schema"
import { Task, CreateTaskInput } from "../schema/task.schema"
import TaskService from "../services/task.service"
import {
  CreateUserTaskInput,
  GetUserTasksInput,
  UserTask,
  UserTaskList,
} from "../schema/task.user.schema"
import Context from "../types/context"

@Resolver()
export default class TaskResolver {
  constructor(private taskService: TaskService) {
    this.taskService = new TaskService()
  }

  @Authorized([Role.Admin])
  @Mutation(() => Task)
  createTask(@Arg("input") input: CreateTaskInput) {
    return this.taskService.createTask(input)
  }

  @Authorized([Role.Admin, Role.Clinician])
  @Mutation(() => UserTask)
  assignTaskToUser(@Arg("input") input: CreateUserTaskInput) {
    return this.taskService.assignTaskToUser(input)
  }

  @Authorized([Role.Patient])
  @Query(() => UserTaskList)
  userTasks(@Ctx() context: Context, @Arg("input") input: GetUserTasksInput) {
    return this.taskService.getUserTasks(context.user._id, input)
  }

  @Authorized([Role.Patient])
  @Query(() => UserTask)
  userTask(@Arg("id") id: string) {
    return this.taskService.getUserTask(id)
  }

  @Authorized([Role.Patient])
  @Query(() => Task, { nullable: true })
  task(@Arg("id") id: string) {
    return this.taskService.getTask(id)
  }
}

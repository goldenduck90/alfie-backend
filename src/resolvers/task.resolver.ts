import { Arg, Authorized, Ctx, Mutation, Query, Resolver } from "type-graphql"
import { Score, User } from "../schema/user.schema"
import Role from "../schema/enums/Role"
import { Task, CreateTaskInput } from "../schema/task.schema"
import TaskService from "../services/task.service"
import {
  CompleteUserTaskInput,
  CreateUserTaskInput,
  CreateUserTasksInput,
  GetUserTasksInput,
  UpdateUserTaskInput,
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

  @Authorized([Role.Admin])
  @Mutation(() => UserTask)
  assignTaskToUser(@Arg("input") input: CreateUserTaskInput) {
    return this.taskService.assignTaskToUser(input)
  }

  @Authorized([Role.Admin])
  @Query(() => [Task])
  getAllTasks() {
    return this.taskService.getAllTasks()
  }

  @Authorized([Role.Admin])
  @Mutation(() => UserTask)
  updateUserTask(
    @Arg("taskId") taskId: string,
    @Arg("input") input: UpdateUserTaskInput
  ) {
    return this.taskService.updateTask(taskId, input)
  }

  @Authorized([Role.Admin])
  @Mutation(() => UserTask)
  archiveTask(@Arg("taskId") taskId: string) {
    return this.taskService.archiveTask(taskId)
  }

  @Authorized([Role.Admin])
  @Query(() => UserTaskList)
  allUserTasks() {
    return this.taskService.getAllUserTasks()
  }

  @Authorized([Role.Admin])
  @Query(() => [UserTask], { nullable: true })
  allUserTasksByUserId(@Arg("userId") userId: string) {
    return this.taskService.getAllUserTasksByUserId(userId)
  }

  @Authorized([Role.Patient])
  @Mutation(() => UserTask)
  completeUserTask(@Arg("input") input: CompleteUserTaskInput) {
    return this.taskService.completeUserTask(input)
  }

  @Authorized([Role.Admin])
  @Mutation(() => [UserTask])
  bulkAssignTasksToUser(@Arg("input") input: CreateUserTasksInput) {
    return this.taskService.bulkAssignTasksToUser(input)
  }

  @Authorized([Role.Patient])
  @Query(() => UserTaskList)
  userTasks(@Ctx() context: Context, @Arg("input") input: GetUserTasksInput) {
    return this.taskService.getUserTasks(context.user._id, input)
  }

  @Authorized([Role.Patient])
  @Query(() => UserTask)
  userTask(@Ctx() context: Context, @Arg("id") id: string) {
    return this.taskService.getUserTask(id, context.user)
  }

  @Authorized([Role.Patient])
  @Query(() => Task, { nullable: true })
  task(@Arg("id") id: string) {
    return this.taskService.getTask(id)
  }

  @Authorized([Role.Admin, Role.Doctor, Role.Practitioner, Role.HealthCoach])
  @Mutation(() => User)
  classifyPatients(@Arg("userId") userId: string) {
    return this.taskService.classifyPatient(userId)
  }

  @Authorized([Role.Admin, Role.Doctor, Role.Practitioner, Role.HealthCoach])
  @Mutation(() => Score)
  scorePatients(@Arg("userId") userId: string) {
    return this.taskService.scorePatient(userId)
  }
}

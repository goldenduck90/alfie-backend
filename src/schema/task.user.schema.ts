import {
  getModelForClass,
  ModelOptions,
  prop,
  queryMethod,
  ReturnModelType,
} from "@typegoose/typegoose"
import { AsQueryMethod, Ref } from "@typegoose/typegoose/lib/types"
import { Field, InputType, ObjectType, registerEnumType } from "type-graphql"
import { Task, TaskType } from "./task.schema"
import { User } from "./user.schema"

export enum AnswerType {
  STRING = "STRING",
  NUMBER = "NUMBER",
  BOOLEAN = "BOOLEAN",
  ARRAY = "ARRAY",
  DATE = "DATE",
  FILE = "FILE",
}

registerEnumType(AnswerType, {
  name: "AnswerType",
  description: "The type of answer",
})

@ObjectType()
@InputType("UserAnswersInput")
@ModelOptions({ schemaOptions: { _id: false } })
export class UserAnswer {
  @Field(() => String)
  @prop({ required: true })
  key: string

  @Field(() => String)
  @prop({ required: true })
  value: any // TODO: make this more specific

  @Field(() => AnswerType)
  @prop({
    required: true,
    default: AnswerType.STRING,
  })
  type: AnswerType
}

function findByTaskId(
  this: ReturnModelType<typeof UserTask, QueryHelpers>,
  taskId: string
) {
  return this.findOne({ task: taskId })
}

function findTasksByUserId(
  this: ReturnModelType<typeof UserTask, QueryHelpers>,
  userId: string
) {
  return this.find({ user: userId })
}

function findUserTask(
  this: ReturnModelType<typeof UserTask, QueryHelpers>,
  userId: string,
  taskId: string
) {
  return this.findOne({ user: userId, task: taskId })
}

interface QueryHelpers {
  findByTaskId: AsQueryMethod<typeof findByTaskId>
  findTasksByUserId: AsQueryMethod<typeof findTasksByUserId>
  findUserTask: AsQueryMethod<typeof findUserTask>
}

@ObjectType()
@queryMethod(findByTaskId)
@queryMethod(findTasksByUserId)
@queryMethod(findUserTask)
export class UserTask {
  @Field(() => String)
  _id: string

  @Field(() => Task, { nullable: true })
  @prop({ ref: () => Task, required: true })
  task: Ref<Task>

  @Field(() => Boolean, { nullable: true })
  @prop({ required: true, default: false })
  archived: boolean

  @Field(() => Boolean, { nullable: true })
  @prop({ required: false, default: false })
  isProfilingReady: boolean

  @Field(() => User)
  @prop({ ref: () => User, required: true })
  user: Ref<User>

  @Field(() => [UserAnswer], { nullable: true })
  @prop({ type: () => [UserAnswer], required: false })
  answers?: UserAnswer[]

  @Field(() => Boolean)
  @prop({ required: true, default: false })
  completed: boolean

  @Field(() => Date, { nullable: true })
  @prop({ required: false })
  dueAt?: Date

  @Field(() => Boolean, { nullable: true })
  pastDue?: boolean

  @Field(() => Boolean)
  @prop({ required: false, default: false })
  highPriority: boolean

  @Field(() => Date, { nullable: true })
  @prop({ required: false })
  lastNotifiedUserAt?: Date

  @Field(() => Date, { nullable: true })
  @prop({ required: false })
  lastNotifiedUserPastDueAt?: Date

  @Field(() => Date, { nullable: true })
  @prop({ required: false })
  lastNotifiedProviderPastDueAt?: Date

  @Field(() => Date, { nullable: true })
  @prop({ required: false })
  lastNotifiedHealthCoachPastDueAt?: Date

  @Field(() => Date, { nullable: true })
  @prop({ required: false })
  completedAt?: Date

  @Field(() => Date, { nullable: true })
  createdAt?: Date

  @Field(() => Date, { nullable: true })
  updatedAt?: Date

  @Field(() => String, { nullable: true })
  providerEmail?: string
}

export const UserTaskModel = getModelForClass<typeof UserTask, QueryHelpers>(
  UserTask,
  {
    schemaOptions: { timestamps: true },
  }
)
@InputType()
export class UpdateUserTaskInput {
  @Field(() => Date)
  lastNotifiedUserAt: Date
}
@InputType()
export class CreateUserTaskInput {
  @Field(() => TaskType)
  taskType: TaskType

  @Field(() => String)
  userId: string
}

@InputType()
export class CreateUserTasksInput {
  @Field(() => [TaskType])
  taskTypes: TaskType[]

  @Field(() => String)
  userId: string
}

@InputType()
export class GetUserTasksInput {
  @Field(() => Number, { nullable: true, defaultValue: 10 })
  limit?: number

  @Field(() => Number, { nullable: true, defaultValue: 0 })
  offset?: number

  @Field(() => Boolean, { nullable: true })
  completed?: boolean

  @Field(() => String, { nullable: true })
  @prop({ required: false })
  userId?: boolean
}

@InputType()
export class CompleteUserTaskInput {
  @Field(() => String)
  _id: string

  @Field(() => [UserAnswer])
  answers: UserAnswer[]
}

@ObjectType()
export class UserTaskList {
  @Field(() => [UserTask], { nullable: true })
  userTasks: UserTask[]

  @Field(() => Number)
  total: number

  @Field(() => Number)
  limit: number

  @Field(() => Number)
  offset: number
}

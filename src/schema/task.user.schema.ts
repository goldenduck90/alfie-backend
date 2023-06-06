import {
  getModelForClass,
  ModelOptions,
  prop,
  queryMethod,
  ReturnModelType,
} from "@typegoose/typegoose"
import { AsQueryMethod, Ref } from "@typegoose/typegoose/lib/types"
import {
  createUnionType,
  Field,
  InputType,
  ObjectType,
  registerEnumType,
} from "type-graphql"
import { Task, TaskType } from "./task.schema"
import { User } from "./user.schema"
import { AnswerType } from "./enums/AnswerType"
import { GraphQLAnyScalar } from "./enums/GraphQLAnyScalar"

registerEnumType(AnswerType, {
  name: "AnswerType",
  description: "The type of answer",
})

@ObjectType()
@InputType("UserAnswersInput")
@ModelOptions({ schemaOptions: { _id: false, discriminatorKey: "type" } })
export class UserAnswer {
  @Field(() => String)
  @prop({ required: true })
  key: string

  @Field(() => AnswerType)
  @prop({ required: true, default: () => AnswerType.STRING })
  type: AnswerType

  @Field(() => GraphQLAnyScalar)
  value: boolean | string | number | Date
}

@ObjectType()
export class UserStringAnswer extends UserAnswer {
  @Field(() => AnswerType)
  @prop({ required: true })
  type: AnswerType.STRING

  @Field(() => String)
  @prop({ required: true })
  value: string
}

@ObjectType()
export class UserNumberAnswer extends UserAnswer {
  @Field(() => AnswerType)
  @prop({ required: true })
  type: AnswerType.NUMBER

  @Field(() => Number)
  @prop({ required: true })
  value: number
}

@ObjectType()
export class UserArrayAnswer extends UserAnswer {
  @Field(() => AnswerType)
  @prop({ required: true })
  type: AnswerType.ARRAY

  @Field(() => String)
  @prop({ required: true })
  value: string // TODO: string[]
}

@ObjectType()
export class UserBooleanAnswer extends UserAnswer {
  @Field(() => AnswerType)
  @prop({ required: true })
  type: AnswerType.BOOLEAN

  @Field(() => Boolean)
  @prop({ required: true })
  value: boolean
}

@ObjectType()
export class UserDateAnswer extends UserAnswer {
  @Field(() => AnswerType)
  @prop({ required: true })
  type: AnswerType.DATE

  @Field(() => Date)
  @prop({ required: true })
  value: Date
}

const UserAnswerClasses = [
  UserStringAnswer,
  UserNumberAnswer,
  UserArrayAnswer,
  UserBooleanAnswer,
  UserDateAnswer,
] as const
export type UserAnswerTypes =
  | UserStringAnswer
  | UserNumberAnswer
  | UserArrayAnswer
  | UserBooleanAnswer
  | UserDateAnswer

export const UserAnswerUnion = createUnionType({
  name: "UserAnswer",
  types: () => UserAnswerClasses,
})

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
  isReadyForProfiling: boolean

  @Field(() => User)
  @prop({ ref: () => User, required: true })
  user: Ref<User>

  @Field(() => [UserAnswerUnion], { nullable: true })
  @prop({
    required: false,
    type: UserAnswer,
    discriminators: () => [
      { type: UserStringAnswer, value: AnswerType.STRING },
      { type: UserNumberAnswer, value: AnswerType.NUMBER },
      { type: UserBooleanAnswer, value: AnswerType.BOOLEAN },
      { type: UserDateAnswer, value: AnswerType.DATE },
      { type: UserArrayAnswer, value: AnswerType.ARRAY },
    ],
  })
  answers?: UserAnswerTypes[]

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
  answers: UserAnswerTypes[]
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

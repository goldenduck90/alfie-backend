import {
  getModelForClass,
  index,
  ModelOptions,
  prop,
  queryMethod,
  ReturnModelType,
} from "@typegoose/typegoose"
import { AsQueryMethod } from "@typegoose/typegoose/lib/types"
import {
  createUnionType,
  Field,
  InputType,
  ObjectType,
  registerEnumType,
} from "type-graphql"
import { AnswerType } from "./enums/AnswerType"

export interface TaskEmail {
  taskName: string
  dueAt: string
  taskId: string
}

export interface AllTaskEmail {
  taskName: string
  dueAt: string
  taskId: string
  userId: string
  userName: string
  userEmail: string
}

export enum TaskType {
  ID_AND_INSURANCE_UPLOAD = "ID_AND_INSURANCE_UPLOAD",
  NEW_PATIENT_INTAKE_FORM = "NEW_PATIENT_INTAKE_FORM",
  DAILY_METRICS_LOG = "DAILY_LOG",
  HR_AND_BP_LOG = "HR_AND_BP_LOG",
  BP_LOG = "BP_LOG",
  MP_HUNGER = "MP_HUNGER",
  MP_FEELING = "MP_FEELING",
  WEIGHT_LOG = "WEIGHT_LOG",
  WAIST_LOG = "WAIST_LOG",
  MP_ACTIVITY = "MP_ACTIVITY", // Steps
  MP_BLUE_CAPSULE = "MP_BLUE_CAPSULE",
  MP_BLUE_CAPSULE_2 = "MP_BLUE_CAPSULE_2",
  SCHEDULE_APPOINTMENT = "SCHEDULE_APPOINTMENT",
  FOOD_LOG = "FOOD_LOG",
  GSRS = "GSRS",
  TEFQ = "TEFQ",
  LAB_SELECTION = "LAB_SELECTION",
  AD_LIBITUM = "AD_LIBITUM",
  SCHEDULE_HEALTH_COACH_APPOINTMENT = "SCHEDULE_HEALTH_COACH_APPOINTMENT",
  TEST = "TEST",
}

registerEnumType(TaskType, {
  name: "TaskType",
  description: "The type of task",
})

function findByType(
  this: ReturnModelType<typeof Task, QueryHelpers>,
  type: TaskType
) {
  return this.findOne({ type })
}

interface QueryHelpers {
  findByType: AsQueryMethod<typeof findByType>
}

@ObjectType()
@InputType("TaskQuestionsInput")
@ModelOptions({ schemaOptions: { _id: false, discriminatorKey: "type" } })
export class TaskQuestion {
  @Field(() => String)
  @prop({ required: true })
  key: string

  @Field(() => AnswerType)
  @prop({ required: true, default: () => AnswerType.STRING })
  type: AnswerType
}

@ObjectType()
export class TaskStringQuestion extends TaskQuestion {
  @Field(() => AnswerType)
  @prop({ required: true })
  type: AnswerType.STRING
}

@ObjectType()
export class TaskNumberQuestion extends TaskQuestion {
  @Field(() => AnswerType)
  @prop({ required: true })
  type: AnswerType.NUMBER
}

@ObjectType()
export class TaskArrayQuestion extends TaskQuestion {
  @Field(() => AnswerType)
  @prop({ required: true })
  type: AnswerType.ARRAY
}

@ObjectType()
export class TaskBooleanQuestion extends TaskQuestion {
  @Field(() => AnswerType)
  @prop({ required: true })
  type: AnswerType.BOOLEAN
}

@ObjectType()
export class TaskDateQuestion extends TaskQuestion {
  @Field(() => AnswerType)
  @prop({ required: true })
  type: AnswerType.DATE
}

const TaskQuestionClasses = [
  TaskStringQuestion,
  TaskNumberQuestion,
  TaskArrayQuestion,
  TaskBooleanQuestion,
  TaskDateQuestion,
] as const
export type TaskQuestionTypes =
  | TaskStringQuestion
  | TaskNumberQuestion
  | TaskArrayQuestion
  | TaskBooleanQuestion
  | TaskDateQuestion

export const TaskQuestionUnion = createUnionType({
  name: "TaskQuestion",
  types: () => TaskQuestionClasses,
})

@index({ name: 1, type: 1 }, { unique: true })
@queryMethod(findByType)
@ObjectType()
export class Task {
  @Field(() => String)
  _id: string

  @Field(() => String, { nullable: true })
  @prop({ required: true })
  name: string

  @Field(() => Boolean, { nullable: true })
  @prop({ required: true, default: false })
  notifyWhenAssigned: boolean

  @Field(() => Boolean)
  @prop({ required: true, default: false })
  notifyWhenPastDue?: boolean

  @Field(() => Boolean)
  @prop({ required: false, default: false })
  notifyProviderWhenPastDue?: boolean

  @Field(() => Boolean)
  @prop({ required: false, default: false })
  notifyHealthCoachWhenPastDue?: boolean

  @Field(() => TaskType)
  @prop({ enum: TaskType, type: String, required: true })
  type: TaskType

  @Field(() => Boolean)
  @prop({ required: true, default: false })
  canHaveMultiple: boolean

  @Field(() => Number, { nullable: true })
  @prop({ required: false })
  daysTillDue?: number

  @Field(() => Boolean)
  @prop({ required: false, default: false })
  highPriority: boolean

  @Field(() => Number, { nullable: true })
  @prop({ required: false })
  interval?: number

  @Field(() => [TaskQuestionUnion], { nullable: true })
  @prop({
    required: false,
    type: TaskQuestion,
    discriminators: () => [
      { type: TaskStringQuestion, value: AnswerType.STRING },
      { type: TaskNumberQuestion, value: AnswerType.NUMBER },
      { type: TaskBooleanQuestion, value: AnswerType.BOOLEAN },
      { type: TaskDateQuestion, value: AnswerType.DATE },
      { type: TaskArrayQuestion, value: AnswerType.ARRAY },
    ],
  })
  questions?: TaskQuestionTypes[]
}

export const TaskModel = getModelForClass<typeof Task, QueryHelpers>(Task, {
  schemaOptions: { timestamps: true },
})

@InputType()
export class CreateTaskInput {
  @Field(() => String)
  name: string

  @Field(() => TaskType)
  type: TaskType

  @Field(() => Boolean, {
    nullable: true,
    defaultValue: false,
    description: "Notify patient when task is assigned.",
  })
  notifyWhenAssigned?: boolean

  @Field(() => Boolean, {
    nullable: true,
    defaultValue: false,
    description:
      "Notify patient when the task becomes past due. Requires hoursTillDue to be set.",
  })
  notifyWhenPastDue?: boolean

  @Field(() => Number, {
    nullable: true,
    defaultValue: false,
    description:
      "If set to true, notifies the patient's provider when the task is past due. Requires hoursTillDue to be set.",
  })
  notifyProviderWhenPastDue?: boolean

  @Field(() => Number, {
    nullable: true,
    defaultValue: false,
    description:
      "If set to true, notifies the patient's health coach when the task is past due. Requires hoursTillDue to be set.",
  })
  notifyHealthCoachWhenPastDue?: boolean

  @Field(() => Boolean, {
    nullable: true,
    defaultValue: false,
    description:
      "If set to true, the task can be assigned multiple times to the same patient without the previously assigned task being completed.",
  })
  canHaveMultiple?: boolean

  @Field(() => Number, {
    nullable: true,
    description:
      "If set, the patient will have the set amount of days to complete the task until they become past due.",
  })
  daysTillDue?: number

  @Field(() => Boolean, {
    nullable: true,
    defaultValue: false,
    description:
      "If set to true, the task will be assigned to the patient as a high priority task.",
  })
  highPriority?: boolean

  @Field(() => Number, {
    nullable: true,
    description:
      "If set, this task will be assigned on a recurring interval. This is a cron expression.",
  })
  interval?: number

  @Field(() => [TaskQuestion], {
    nullable: true,
    description:
      "If set, the task will have answers that must conform to these questions.",
  })
  questions?: TaskQuestionTypes[]
}

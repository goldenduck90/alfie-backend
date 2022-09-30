import {
  getModelForClass,
  prop,
  index,
  ReturnModelType,
  queryMethod,
} from "@typegoose/typegoose"
import { AsQueryMethod } from "@typegoose/typegoose/lib/types"
import { registerEnumType } from "type-graphql"
import { Field, InputType, ObjectType } from "type-graphql"

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

  @Field(() => String, { nullable: true })
  @prop({ required: false })
  interval?: string
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

  @Field(() => String, {
    nullable: true,
    description:
      "If set, this task will be assigned on a recurring interval. This is a cron expression.",
  })
  interval?: string
}

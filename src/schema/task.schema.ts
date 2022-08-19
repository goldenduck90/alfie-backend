import { getModelForClass, prop, index } from "@typegoose/typegoose"
import { registerEnumType } from "type-graphql"
import { Field, InputType, ObjectType } from "type-graphql"

export enum TaskType {
  INTERVAL = "INTERVAL",
  TRIGGER = "TRIGGER",
}

registerEnumType(TaskType, {
  name: "TaskType",
  description: "Type of Task",
})

@index({ name: 1 })
@ObjectType()
export class Task {
  @Field(() => String)
  _id: string

  @Field(() => String)
  @prop({ required: true })
  name: string

  @Field(() => TaskType)
  @prop({
    enum: TaskType,
    type: String,
    required: true,
    default: TaskType.TRIGGER,
  })
  type: TaskType

  @Field(() => Boolean)
  @prop({ required: true, default: false })
  notifyWhenAssigned: boolean

  @Field(() => Number)
  @prop({ required: false })
  hoursTillDue?: number

  @Field(() => String)
  @prop({ required: false })
  interval?: string
}

export const TaskModel = getModelForClass<typeof Task>(Task, {
  schemaOptions: { timestamps: true },
})

@InputType()
export class CreateTaskInput {
  @Field(() => String)
  name: string

  @Field(() => TaskType, { nullable: true, defaultValue: TaskType.TRIGGER })
  type?: string

  @Field(() => Boolean, {
    nullable: true,
    defaultValue: false,
    description: "Notify user when task is assigned.",
  })
  notifyWhenAssigned?: boolean

  @Field(() => Number, {
    nullable: true,
    description:
      "If set, the patient will have the set amount of hours to complete the task until they become past due.",
  })
  hoursTillDue?: number

  @Field(() => String, {
    nullable: true,
    description: "Interval in cron format",
  })
  interval?: string
}

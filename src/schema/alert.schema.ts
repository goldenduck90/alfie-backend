import { Ref, getModelForClass, prop } from "@typegoose/typegoose"
import { Field, ObjectType, registerEnumType } from "type-graphql"
import { Task } from "./task.schema"
import { User } from "./user.schema"

export enum SeverityType {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
  EXTREME = "EXTREME",
}

registerEnumType(SeverityType, {
  name: "SeverityType",
  description: "Alert severity type.",
})

@ObjectType()
export class Alert {
  @Field(() => String)
  _id: string

  @Field(() => String)
  @prop({ required: true })
  title: string

  @Field(() => String)
  @prop({ required: true })
  description: string

  @Field(() => Task)
  @prop({ ref: () => Task, required: true })
  task: Ref<Task>

  @Field(() => User)
  @prop({ ref: () => User, required: true })
  user: Ref<User>

  @Field(() => SeverityType)
  @prop({ enum: SeverityType, required: true })
  severity: SeverityType

  @Field(() => Boolean)
  @prop({ required: true })
  medical: boolean

  @Field(() => Date, { nullable: true })
  @prop({ required: false })
  acknowledgedAt?: Date

  @Field(() => Date, { nullable: true })
  @prop({ required: false })
  notifiedAt?: Date
}

export const AlertModel = getModelForClass<typeof Alert>(Alert, {
  schemaOptions: { timestamps: true },
})

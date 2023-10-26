import {
  Ref,
  getModelForClass,
  prop,
  ModelOptions,
  Severity,
} from "@typegoose/typegoose"
import { Field, ObjectType, InputType } from "type-graphql"
import { User } from "./user.schema"
import { Provider } from "./provider.schema"

@ObjectType()
@InputType("NPSQuestionsInput")
@ModelOptions({ schemaOptions: { _id: false, discriminatorKey: "question" } })
export class NPSQuestion {
  @Field(() => String)
  @prop({ required: true })
  question: string

  @Field(() => Number, { nullable: true })
  @prop({ required: false })
  value?: number

  @Field(() => String, { nullable: true })
  @prop({ required: false })
  textAnswer?: string
}

@ObjectType()
export class NPS {
  @Field(() => String)
  _id: string

  @Field(() => String)
  @prop({ required: true })
  appointmentId: string

  @Field(() => User)
  @prop({ ref: () => User, required: true })
  user: Ref<User>

  @Field(() => Provider)
  @prop({ ref: () => Provider, required: true })
  provider: Ref<Provider>

  @Field(() => [NPSQuestion], { nullable: true })
  @prop({ required: false, allowMixed: Severity.ALLOW })
  questions?: NPSQuestion[]

  @Field(() => Date, { nullable: true })
  createdAt?: Date

  @Field(() => Date, { nullable: true })
  updatedAt?: Date
}

export const NPSModel = getModelForClass<typeof NPS>(NPS, {
  schemaOptions: { timestamps: true },
})

import { Ref, getModelForClass, prop } from "@typegoose/typegoose"
import { Field, ObjectType, InputType } from "type-graphql"
import { User } from "./user.schema"

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

  @Field(() => Number, { nullable: true })
  @prop({ required: false })
  score: number

  @Field(() => String, { nullable: true })
  @prop({ required: false })
  textAnswer?: string

  @Field(() => String, { nullable: true })
  @prop({ required: false })
  feedback?: string

  @Field(() => Date, { nullable: true })
  createdAt?: Date

  @Field(() => Date, { nullable: true })
  updatedAt?: Date
}

export const NPSModel = getModelForClass<typeof NPS>(NPS, {
  schemaOptions: { timestamps: true },
})

@InputType()
export class NPSInput {
  @Field(() => String)
  id: string

  @Field(() => Number)
  score: number

  @Field(() => String, { nullable: true })
  textAnswer?: string

  @Field(() => String, { nullable: true })
  feedback?: string
}

import { Ref, getModelForClass, prop } from "@typegoose/typegoose"
import { Field, ObjectType } from "type-graphql"
import { User } from "./user.schema"
import { Provider } from "./provider.schema"

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

  @Field(() => Number, { nullable: true })
  @prop({ required: false })
  value: number

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

import { ModelOptions, Ref, getModelForClass, prop } from "@typegoose/typegoose"
import { Field, ObjectType } from "type-graphql"
import { User } from "./user.schema"

@ObjectType()
export class MetriportConnectResponse {
  @Field()
  url: string
}

@ObjectType()
@ModelOptions({ schemaOptions: { _id: false, discriminatorKey: "user" } })
export class MetriportMedicalData {
  @Field(() => User, { nullable: true })
  @prop({ ref: () => User, required: true })
  user: Ref<User>

  @Field(() => [String])
  @prop({ default: [], required: true })
  resources: string[]

  @prop({ required: false })
  entries?: any[]
}

export const MetriportMedicalDataModel =
  getModelForClass<typeof MetriportMedicalData>(MetriportMedicalData)

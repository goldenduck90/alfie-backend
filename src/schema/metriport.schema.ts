import { Ref, getModelForClass, prop } from "@typegoose/typegoose"
import { Field, ObjectType } from "type-graphql"
import { User } from "./user.schema"

@ObjectType()
export class MetriportConnectResponse {
  @Field()
  url: string
}

@ObjectType()
export class MetriportMedicalData {
  @Field(() => String)
  _id: string

  @Field(() => User, { nullable: true })
  @prop({ ref: () => User, required: true })
  user: Ref<User>

  @Field(() => [String])
  @prop({ default: [], required: true })
  resources: string[]

  @prop({ required: false })
  entries?: any[]
}

export const MetriportMedicalDataModel = getModelForClass<
  typeof MetriportMedicalData
>(MetriportMedicalData, {
  schemaOptions: { timestamps: true },
})

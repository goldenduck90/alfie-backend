import { getModelForClass, index, prop } from "@typegoose/typegoose"
import { Field, ObjectType } from "type-graphql"

@index({ name: 1 }, { unique: true })
@index({ type: 1 }, { unique: true })
@ObjectType()
export class InsuranceType {
  @Field(() => String)
  _id: string

  @Field(() => String, { nullable: true })
  @prop({ required: true })
  name: string
}

@index({ name: 1 }, { unique: true })
@index({ type: 1 }, { unique: true })
@ObjectType()
export class InsurancePlan {
  @Field(() => String)
  _id: string

  @Field(() => String, { nullable: true })
  @prop({ required: true })
  name: string

  @Field(() => InsuranceType)
  @prop({ enum: InsuranceType, type: String, required: true })
  type: InsuranceType
}

export const InsurancePlanModel = getModelForClass<typeof InsurancePlan>(
  InsurancePlan,
  { schemaOptions: { timestamps: true } }
)

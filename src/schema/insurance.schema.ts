import { getModelForClass, index, prop } from "@typegoose/typegoose"
import { Field, ObjectType } from "type-graphql"

export enum InsuranceTypeValue {
  EPO = "EPO",
  POS = "POS",
  PPO = "PPO",
  HMO = "HMO",
  GOVERNMENT_MEDICAID_TRICARE_CHIP = "GOVERNMENT_MEDICAID_TRICARE_CHIP",
}

@index({ name: 1 }, { unique: true })
@index({ type: 1 }, { unique: true })
@ObjectType()
export class InsuranceType {
  @Field(() => String)
  _id: string

  @Field(() => String, { nullable: true })
  @prop({ required: true })
  name: string

  @Field(() => InsuranceTypeValue)
  @prop({ enum: InsuranceTypeValue, type: String, required: true })
  type: InsuranceTypeValue
}

export const InsuranceTypeModel = getModelForClass<typeof InsuranceType>(
  InsuranceType,
  { schemaOptions: { timestamps: true } }
)

export enum InsurancePlanType {
  BCBS = "BCBS",
  ANTHEM_BCBS = "ANTHEM_BCBS",
  EMPIRE_BCBS = "EMPIRE_BCBS",
  CAREFIRST_BCBS = "CAREFIRST_BCBS",
  HORIZON_BCBS = "HORIZON_BCBS",
  HUMANA = "HUMANA",
  PARTNER_DIRECT = "PARTNER_DIRECT",
  AETNA = "AETNA",
  UNITED_HEALTHCARE = "UNITED_HEALTHCARE",
  CIGNA = "CIGNA",
  MEDICARE = "MEDICARE",
  MEDICAID = "MEDICAID",
  OTHER = "OTHER",
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

  @Field(() => InsurancePlanType)
  @prop({ enum: InsurancePlanType, type: String, required: true })
  type: InsurancePlanType
}

export const InsurancePlanModel = getModelForClass<typeof InsurancePlan>(
  InsurancePlan,
  { schemaOptions: { timestamps: true } }
)

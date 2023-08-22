import { Ref, getModelForClass, index, prop } from "@typegoose/typegoose"
import { Field, InputType, ObjectType, registerEnumType } from "type-graphql"
import {
  Address,
  Gender,
  Insurance,
  InsuranceEligibilityResponse,
} from "./user.schema"
import { Provider } from "./provider.schema"

export enum InsuranceTypeValue {
  EPO = "EPO",
  POS = "POS",
  PPO = "PPO",
  HMO = "HMO",
  Government = "GOVERNMENT_MEDICAID_TRICARE_CHIP",
}

registerEnumType(InsuranceTypeValue, {
  name: "InsuranceTypeValue",
  description: "An insurance type enum value.",
})

/** General insurance types. */
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

export enum InsurancePlanValue {
  BCBS = "BCBS",
  AnthemBCBS = "ANTHEM_BCBS",
  EmpireBCBS = "EMPIRE_BCBS",
  CarefirstBCBS = "CAREFIRST_BCBS",
  HorizonBCBS = "HORIZON_BCBS",
  Humana = "HUMANA",
  PartnerDirect = "PARTNER_DIRECT",
  Aetna = "AETNA",
  UnitedHealthcare = "UNITED_HEALTHCARE",
  Cigna = "CIGNA",
  Medicare = "MEDICARE",
  Medicaid = "MEDICAID",
  Other = "OTHER",
}

registerEnumType(InsurancePlanValue, {
  name: "InsurancePlanValue",
  description: "An insurance plan enum value.",
})

/** Information on coverage of insurance plan/type combinations. */
@ObjectType()
export class InsurancePlanCoverage {
  @Field(() => String)
  _id: string

  @Field(() => InsurancePlanValue)
  @prop({ enum: InsurancePlanValue, type: String, required: true })
  plan: InsurancePlanValue

  @Field(() => InsuranceTypeValue, { nullable: true })
  @prop({
    enum: Object.values(InsuranceTypeValue).concat([null]),
    type: String,
    required: false,
  })
  type?: InsuranceTypeValue

  @Field(() => Provider, { nullable: true })
  @prop({ ref: () => Provider, required: false })
  provider?: Ref<Provider>

  @Field({ nullable: true })
  @prop()
  state?: string

  @Field(() => Boolean)
  @prop({ required: true })
  covered: boolean
}

export const InsurancePlanCoverageModel = getModelForClass<
  typeof InsurancePlanCoverage
>(InsurancePlanCoverage, {
  schemaOptions: { timestamps: true },
  options: { customName: "insurancePlanCoverage" },
})

/** Insurance plans. */
@index({ name: 1 }, { unique: true })
@index({ type: 1 }, { unique: true })
@ObjectType()
export class InsurancePlan {
  @Field(() => String)
  _id: string

  @Field(() => String, { nullable: true })
  @prop({ required: true })
  name: string

  @Field(() => InsurancePlanValue)
  @prop({ enum: InsurancePlanValue, type: String, required: true })
  value: InsurancePlanValue

  /** If set, limits the types associated with this plan. */
  @Field(() => [InsuranceTypeValue])
  @prop({ enum: InsuranceTypeValue, type: String, required: false })
  types?: InsuranceTypeValue[]
}

export const InsurancePlanModel = getModelForClass<typeof InsurancePlan>(
  InsurancePlan,
  { schemaOptions: { timestamps: true } }
)

@ObjectType()
export class InsuranceCoveredResponse {
  @Field(() => Boolean)
  covered: boolean

  @Field(() => String, { nullable: true })
  reason?: string
}

@InputType()
export class InsuranceCheckInput {
  @Field(() => String)
  checkoutId: string

  @Field(() => InsurancePlanValue)
  insurancePlan: InsurancePlanValue

  @Field(() => InsuranceTypeValue)
  insuranceType: InsuranceTypeValue

  @Field(() => Insurance)
  insurance: Insurance
}

@ObjectType()
export class InsuranceCheckResponse {
  @Field(() => InsuranceCoveredResponse)
  covered: InsuranceCoveredResponse

  @Field(() => InsuranceEligibilityResponse)
  eligible: InsuranceEligibilityResponse
}

@InputType()
export class BasicUserInsuranceInfo {
  @Field()
  name: string

  @Field()
  dateOfBirth: Date

  @Field(() => Gender)
  gender: Gender

  @Field(() => String)
  state: string
}

@ObjectType()
export class InsurancePlansResponse {
  @Field(() => [InsurancePlan])
  plans: InsurancePlan[]

  @Field(() => [InsuranceType])
  types: InsuranceType[]
}

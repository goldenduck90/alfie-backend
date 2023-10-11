import {
  ModelOptions,
  Ref,
  getModelForClass,
  index,
  mongoose,
  prop,
} from "@typegoose/typegoose"
import { Field, InputType, ObjectType, registerEnumType } from "type-graphql"
import { Provider } from "./provider.schema"

export enum InsuranceType {
  EPO = "EPO",
  POS = "POS",
  PPO = "PPO",
  HMO = "HMO",
  MEDICARE = "MEDICARE",
}

registerEnumType(InsuranceType, {
  name: "InsuranceType",
  description: "Types of insurance plans supported.",
})

export enum InsuranceStatus {
  ACTIVE = "ACTIVE",
  NOT_ACTIVE = "NOT_ACTIVE",
  COMING_SOON = "COMING_SOON",
}

registerEnumType(InsuranceStatus, {
  name: "InsuranceStatus",
  description:
    "Status of insurance, whether it's active, not active, or coming soon.",
})

/** Insurance State */
@ObjectType()
@ModelOptions({ schemaOptions: { _id: false } })
export class InsuranceState {
  @Field(() => String)
  @prop({ required: true })
  state: string

  @Field(() => InsuranceStatus)
  @prop({ enum: InsuranceStatus, type: String, required: true })
  status: InsuranceStatus

  @Field(() => [InsuranceType])
  @prop({ enum: InsuranceType, type: [String], required: true, default: [] })
  types: InsuranceType[]

  @Field(() => String)
  @prop({ required: true })
  npi: string

  @Field(() => String)
  @prop({ required: true })
  cpid: string

  @Field(() => [Provider], { nullable: true })
  @prop({ ref: () => Provider, type: [String], required: true, default: [] })
  providers: Ref<Provider>[]
}

/** Insurance plans. */
@index({ name: 1 }, { unique: true })
@ObjectType()
export class Insurance {
  @Field(() => String)
  _id: string

  @Field(() => String)
  @prop({ required: true })
  name: string

  @Field(() => [InsuranceState], { defaultValue: [] })
  @prop({ default: [], required: true })
  states: mongoose.Types.Array<InsuranceState>
}

export const InsuranceModel = getModelForClass<typeof Insurance>(Insurance, {
  schemaOptions: { timestamps: true },
})

@ObjectType()
@ModelOptions({ schemaOptions: { _id: false } })
export class InsuranceDetails {
  @Field(() => String)
  @prop({ required: true })
  memberId: string

  @Field(() => String)
  @prop({ required: true })
  groupId: string

  @Field(() => Insurance)
  @prop({ ref: () => Insurance, required: true })
  insurance: Ref<Insurance>

  @Field(() => InsuranceStatus, { nullable: true })
  @prop({ enum: InsuranceStatus, type: String, required: false })
  status?: InsuranceStatus

  @Field(() => InsuranceType)
  @prop({ enum: InsuranceType, type: String, required: true })
  type: InsuranceType

  /** The payer ID. */
  @Field(() => String, { nullable: true })
  @prop()
  payorId?: string

  @Field(() => String, { nullable: true })
  @prop()
  payorName?: string

  @Field(() => String, { nullable: true })
  @prop()
  groupName?: string

  @Field(() => String, { nullable: true })
  @prop()
  rxBIN?: string

  @Field(() => String, { nullable: true })
  @prop()
  rxPCN?: string

  @Field(() => String, { nullable: true })
  @prop()
  rxGroup?: string
}

@ObjectType()
export class InsurancePayor {
  @Field(() => String)
  payorId: string

  @Field(() => String)
  payorName: string
}

@ObjectType()
export class InsuranceCheckResponse {
  @Field(() => InsuranceStatus)
  status: InsuranceStatus

  @Field(() => Boolean)
  eligible: boolean

  @Field(() => InsurancePayor, { nullable: true })
  payor?: InsurancePayor

  @Field(() => [String], { defaultValue: [] })
  errors: string[]
}

@InputType()
export class InsuranceDetailsInput {
  @Field(() => String)
  memberId: string

  @Field(() => String)
  groupId: string

  @Field(() => String)
  insurance: string

  @Field(() => InsuranceStatus, { nullable: true })
  status?: InsuranceStatus

  @Field(() => InsuranceType)
  type: InsuranceType

  /** The payer ID. */
  @Field(() => String, { nullable: true })
  payorId?: string

  @Field(() => String, { nullable: true })
  payorName?: string

  @Field(() => String, { nullable: true })
  groupName?: string

  @Field(() => String, { nullable: true })
  rxBIN?: string

  @Field(() => String, { nullable: true })
  rxPCN?: string

  @Field(() => String, { nullable: true })
  rxGroup?: string
}

@InputType()
export class InsuranceCheckInput {
  @Field(() => String)
  checkoutId: string

  @Field(() => InsuranceDetailsInput)
  insurance: InsuranceDetailsInput
}

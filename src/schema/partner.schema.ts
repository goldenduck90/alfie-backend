import { Field, ObjectType, registerEnumType } from "type-graphql"
import { getModelForClass, index, prop } from "@typegoose/typegoose"
import { Ref } from "@typegoose/typegoose/lib/types"

export enum FlowType {
  SingleStep = "SingleStep",
  MultiStep = "MultiStep",
}

registerEnumType(FlowType, {
  name: "FlowType",
  description: "Signup flow type whether single step or multi step",
})

@index({ title: 1 }, { unique: true })
@ObjectType()
export class SignupPartner {
  @Field(() => String)
  _id: string

  @Field(() => String)
  @prop({ required: true })
  title: string

  @Field(() => String, { nullable: true })
  @prop({ required: false })
  logoUrl: string

  @Field(() => FlowType)
  @prop({
    default: FlowType.SingleStep,
    required: true,
  })
  flowType: FlowType

  @Field(() => String, { nullable: true })
  @prop()
  stripePriceId?: string
}

export const SignupPartnerModel = getModelForClass<typeof SignupPartner>(
  SignupPartner,
  {
    schemaOptions: { timestamps: true },
  }
)

@ObjectType()
export class SignupPartnerProvider {
  @Field(() => String)
  _id: string

  @Field(() => String)
  @prop({ required: true })
  title: string

  @Field(() => String, { nullable: true })
  @prop({ required: false })
  faxNumber: string

  @Field(() => String)
  @prop({ required: true })
  npi: string

  @Field(() => SignupPartner)
  @prop({ ref: () => SignupPartner, required: true })
  signupPartner: Ref<SignupPartner>

  @Field(() => String)
  @prop({ required: true })
  address: string

  @Field(() => String)
  @prop({ required: true })
  city: string

  @Field(() => String)
  @prop({ required: true })
  state: string

  @Field(() => String)
  @prop({ required: true })
  zipCode: string

  @Field(() => String)
  @prop({ required: true })
  phone: string
}

export const SignupPartnerProviderModel = getModelForClass<
  typeof SignupPartnerProvider
>(SignupPartnerProvider, {
  schemaOptions: { timestamps: true },
})

@ObjectType()
export class SingupPartnerResponse {
  @Field(() => SignupPartner)
  partner: SignupPartner

  @Field(() => [SignupPartnerProvider], { nullable: true })
  partnerProviders?: SignupPartnerProvider[]
}

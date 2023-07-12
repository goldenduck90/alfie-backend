import { Field, ObjectType } from "type-graphql"
import { getModelForClass, index, prop } from "@typegoose/typegoose"
import { Ref } from "@typegoose/typegoose/lib/types"

@index({ title: 1 }, { unique: true })
@ObjectType()
export class SignupPartner {
  @Field(() => String)
  _id: string

  @Field(() => String)
  @prop({ required: true })
  title: string

  @Field(() => String)
  @prop({ required: true })
  logoUrl: string
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

  @Field(() => String)
  @prop({ required: true })
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

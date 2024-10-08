import {
  getModelForClass,
  prop,
  ReturnModelType,
  queryMethod,
  index,
  Severity,
  modelOptions,
} from "@typegoose/typegoose"
import { AsQueryMethod, Ref } from "@typegoose/typegoose/lib/types"
import { IsEmail, IsPhoneNumber } from "class-validator"
import { Field, InputType, ObjectType } from "type-graphql"
import config from "config"
import { Address, Gender, User } from "./user.schema"
import { SignupPartner, SignupPartnerProvider } from "./partner.schema"
import { InsuranceDetails } from "./insurance.schema"
import { Provider } from "./provider.schema"

const { email: emailValidation, phone: phoneValidation } = config.get(
  "validations"
) as any

function findByEmail(
  this: ReturnModelType<typeof Checkout, QueryHelpers>,
  email: Checkout["email"]
) {
  return this.findOne({ email })
}

function findByStripeCustomerId(
  this: ReturnModelType<typeof Checkout, QueryHelpers>,
  stripeCustomerId: Checkout["stripeCustomerId"]
) {
  return this.findOne({ stripeCustomerId })
}

function findByStripeSubscriptionId(
  this: ReturnModelType<typeof Checkout, QueryHelpers>,
  stripeSubscriptionId: Checkout["stripeSubscriptionId"]
) {
  return this.findOne({ stripeSubscriptionId })
}

function findByStripeSetupIntentId(
  this: ReturnModelType<typeof Checkout, QueryHelpers>,
  stripeSetupIntentId: Checkout["stripeSetupIntentId"]
) {
  return this.findOne({ stripeSetupIntentId })
}

interface QueryHelpers {
  findByEmail: AsQueryMethod<typeof findByEmail>
  findByStripeCustomerId: AsQueryMethod<typeof findByStripeCustomerId>
  findByStripeSubscriptionId: AsQueryMethod<typeof findByStripeSubscriptionId>
  findByStripeSetupIntentId: AsQueryMethod<typeof findByStripeSetupIntentId>
}

@index({ email: 1 })
@queryMethod(findByEmail)
@queryMethod(findByStripeCustomerId)
@queryMethod(findByStripeSubscriptionId)
@queryMethod(findByStripeSetupIntentId)
@ObjectType()
@modelOptions({ options: { allowMixed: Severity.ALLOW } })
export class Checkout {
  @Field(() => String)
  _id: string

  @Field(() => String)
  @prop({ required: false })
  stripeCustomerId?: string

  @Field(() => String)
  @prop({ required: false })
  stripeSubscriptionId?: string

  @Field(() => String)
  @prop({ required: false })
  stripeSetupIntentId?: string

  @Field(() => String)
  @prop({ required: false })
  stripeClientSecret?: string

  @Field(() => Address)
  @prop({ required: false })
  shippingAddress?: Address

  @Field(() => Address)
  @prop({ required: false })
  billingAddress?: Address

  @Field(() => Boolean)
  sameAsShippingAddress?: boolean

  @Field(() => String)
  @prop({ required: true })
  name: string

  @Field(() => String)
  @prop({ required: true })
  email: string

  @Field(() => Date)
  @prop({ required: true })
  dateOfBirth: Date

  @Field(() => Gender)
  @prop({ enum: Gender, type: String, required: true })
  gender: Gender

  @Field(() => String)
  @prop({ required: true })
  state: string

  @Field(() => Number)
  @prop({ required: true })
  heightInInches: number

  @Field(() => Number)
  @prop({ required: true })
  weightInLbs: number

  @Field(() => Boolean)
  @prop({ default: false, required: true })
  checkedOut: boolean

  @Field(() => String)
  @prop()
  stripeCheckoutId?: string

  @Field(() => User, { nullable: true })
  @prop({ ref: () => User, type: String, required: false })
  user?: Ref<User>

  @Field(() => Boolean, { nullable: true })
  @prop({ default: false, required: false })
  textOptIn: boolean

  @Field(() => String)
  @prop({ required: true })
  phone: string

  @Field(() => [String])
  @prop({ required: true })
  weightLossMotivatorV2: string[]

  @Field(() => [String])
  @prop({ required: true, allowMixed: Severity.ALLOW })
  pastTries: string[]

  @Field(() => InsuranceDetails, { nullable: true })
  @prop({ required: false })
  insurance?: InsuranceDetails

  @Field(() => Provider, { nullable: true })
  @prop({ ref: () => Provider, required: false })
  provider?: Ref<Provider>

  @Field(() => SignupPartner, { nullable: true })
  @prop({ ref: () => SignupPartner, required: false })
  signupPartner?: Ref<SignupPartner>

  @Field(() => SignupPartnerProvider, { nullable: true })
  @prop({ ref: () => SignupPartnerProvider, required: false })
  signupPartnerProvider?: Ref<SignupPartnerProvider>

  @Field(() => String, { nullable: true })
  @prop({ type: String, required: false })
  referrer?: string
}

export const CheckoutModel = getModelForClass<typeof Checkout, QueryHelpers>(
  Checkout,
  {
    schemaOptions: { timestamps: true },
  }
)

@InputType()
export class CreateCheckoutInput {
  @Field(() => String)
  name: string

  @IsEmail({}, { message: emailValidation.message })
  @Field(() => String)
  email: string

  @Field(() => Date)
  dateOfBirth: Date

  @Field(() => Gender)
  gender: Gender

  @Field(() => String)
  state: string

  @Field(() => Number)
  heightInInches: number

  @Field(() => Number)
  weightInLbs: number

  @Field(() => Boolean, { nullable: true })
  textOptIn: boolean

  @IsPhoneNumber("US", { message: phoneValidation.message })
  @Field(() => String)
  phone: string

  @Field(() => [String], { nullable: true })
  weightLossMotivatorV2: string[]

  @Field(() => [String])
  pastTries: string[]

  @Field(() => String, { nullable: true })
  signupPartnerId?: string

  @Field(() => String, { nullable: true })
  signupPartnerProviderId?: string

  @Field(() => String, { nullable: true })
  referrer?: string
}

@InputType()
export class GetCheckoutInput {
  @Field(() => String)
  _id: string
}

@InputType()
export class CheckoutAddressInput {
  @Field(() => String)
  _id: string

  @Field(() => Address)
  shipping: Address

  @Field(() => Address, { nullable: true })
  billing?: Address

  @Field(() => Boolean)
  sameAsShipping: boolean
}

@InputType()
export class CompleteCheckoutInput {
  @Field(() => String, { description: "Stripe subscription ID" })
  stripeSubscriptionId: string

  @Field(() => Date, {
    nullable: true,
    description:
      "When the user's subscription expires. Retrieved from Stripe checkout. Default is 1 month from now.",
  })
  subscriptionExpiresAt?: Date
}

@ObjectType()
export class CheckoutResponse {
  @Field(() => String, { nullable: true })
  message: string

  @Field(() => Checkout)
  checkout: Checkout
}

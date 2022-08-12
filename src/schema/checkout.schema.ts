import {
  getModelForClass,
  prop,
  ReturnModelType,
  queryMethod,
  index,
} from "@typegoose/typegoose"
import { AsQueryMethod, Ref } from "@typegoose/typegoose/lib/types"
import { IsEmail, IsPhoneNumber } from "class-validator"
import { Field, InputType, ObjectType } from "type-graphql"
import config from "config"
import { Address, Gender, User } from "./user.schema"

const { email: emailValidation, phone: phoneValidation } =
  config.get("validations")

function findByEmail(
  this: ReturnModelType<typeof Checkout, QueryHelpers>,
  email: Checkout["email"]
) {
  return this.findOne({ email })
}

function findByStripePaymentLinkId(
  this: ReturnModelType<typeof Checkout, QueryHelpers>,
  stripePaymentLinkId: Checkout["stripePaymentLinkId"]
) {
  return this.findOne({ stripePaymentLinkId })
}

interface QueryHelpers {
  findByEmail: AsQueryMethod<typeof findByEmail>
  findByStripePaymentLinkId: AsQueryMethod<typeof findByStripePaymentLinkId>
}

@index({ email: 1 })
@index({ stripePaymentLinkId: 1 })
@queryMethod(findByEmail)
@queryMethod(findByStripePaymentLinkId)
@ObjectType()
export class Checkout {
  @Field(() => String)
  _id: string

  @Field(() => String)
  @prop({ required: true })
  stripePaymentLinkId: string

  @Field(() => String)
  @prop({ required: true })
  name: string

  @Field(() => String)
  @prop({ required: true })
  email: string

  @Field(() => String)
  @prop({ required: true })
  weightLossMotivator: string

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
  @prop({ ref: "User" })
  user?: Ref<User>
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

  @Field(() => String)
  weightLossMotivator: string

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
}

@InputType()
export class GetCheckoutInput {
  @Field(() => String)
  _id: string
}
@InputType()
export class CompleteCheckoutInput {
  @Field(() => String, { description: "Stripe payment link ID" })
  stripePaymentLinkId: string

  @Field(() => String, { description: "Stripe subscription ID" })
  stripeSubscriptionId: string

  @Field(() => String, { description: "Stripe customer ID" })
  stripeCustomerId: string

  @Field(() => String, { description: "Stripe checkout ID" })
  stripeCheckoutId: string

  @IsPhoneNumber("US", { message: phoneValidation.message })
  @Field(() => String)
  phone: string

  @Field(() => Address, { description: "Retrieved from Stripe checkout" })
  address: Address

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

  @Field(() => String)
  paymentLink: string
}

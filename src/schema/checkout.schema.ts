import {
  getModelForClass,
  prop,
  ReturnModelType,
  queryMethod,
  index,
} from "@typegoose/typegoose"
import { registerEnumType } from "type-graphql"
import { AsQueryMethod, Ref } from "@typegoose/typegoose/lib/types"
import { IsEmail } from "class-validator"
import { Field, InputType, ObjectType } from "type-graphql"
import config from "config"
import { User } from "./user.schema"

const { email: emailValidation } = config.get("validations")

export enum Gender {
  Male = "male",
  Female = "female",
}

registerEnumType(Gender, {
  name: "Gender",
  description: "",
})

function findByEmail(
  this: ReturnModelType<typeof Checkout, QueryHelpers>,
  email: Checkout["email"]
) {
  return this.findOne({ email })
}

interface QueryHelpers {
  findByEmail: AsQueryMethod<typeof findByEmail>
}

@index({ email: 1 })
@queryMethod(findByEmail)
@ObjectType()
export class Checkout {
  @Field(() => String)
  _id: string

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
  @prop({ required: true })
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
  stripeCustomerId: string

  @Field(() => User, { nullable: true })
  @prop({ ref: () => User, type: () => String })
  @prop()
  user: Ref<User>
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

@ObjectType()
export class CheckoutResponse {
  @Field(() => String, { nullable: true })
  message: string

  @Field(() => Checkout)
  checkout: Checkout
}

import {
  getModelForClass,
  prop,
  pre,
  ReturnModelType,
  queryMethod,
  index,
  ModelOptions,
} from "@typegoose/typegoose"
import { registerEnumType } from "type-graphql"
import { AsQueryMethod } from "@typegoose/typegoose/lib/types"
import bcrypt from "bcrypt"
import {
  IsDate,
  IsEmail,
  IsPhoneNumber,
  MaxDate,
  MaxLength,
  MinLength,
} from "class-validator"
import { Field, InputType, ObjectType } from "type-graphql"
import config from "config"
import mongoose from "mongoose"

const {
  email: emailValidation,
  phone: phoneValidation,
  password,
  dateOfBirth: dateOfBirthValidation,
} = config.get("validations")
const { rememberExp, normalExp } = config.get("jwtExpiration")

@ObjectType()
@InputType("AddressInput")
@ModelOptions({ schemaOptions: { _id: false } })
export class Address {
  @Field(() => String)
  @prop({ required: true })
  line1: string

  @Field(() => String, { nullable: true })
  @prop()
  line2?: string

  @Field(() => String)
  @prop({ required: true })
  city: string

  @Field(() => String)
  @prop({ required: true })
  state: string

  @Field(() => String)
  @prop({ required: true })
  postalCode: string

  @Field(() => String)
  @prop({ default: "US", required: true })
  country: string
}

@ObjectType()
export class Weight {
  @Field(() => Number)
  @prop({ required: true })
  value: number

  @Field(() => Date)
  @prop({ default: Date.now(), required: true })
  date: Date
}

export enum Gender {
  Male = "male",
  Female = "female",
}

registerEnumType(Gender, {
  name: "Gender",
  description: "",
})

export enum Role {
  Patient = "PATIENT",
  Clinician = "CLINICIAN",
  Admin = "ADMIN",
  BillingLock = "BILLING_LOCK",
}

registerEnumType(Role, {
  name: "Role",
  description: "The user roles a user can be assigned to",
})

function findByEmail(
  this: ReturnModelType<typeof User, QueryHelpers>,
  email: User["email"]
) {
  return this.findOne({ email })
}

function findByEmailToken(
  this: ReturnModelType<typeof User, QueryHelpers>,
  emailToken: User["emailToken"]
) {
  return this.findOne({ emailToken })
}

function findBySubscriptionId(
  this: ReturnModelType<typeof User, QueryHelpers>,
  stripeSubscriptionId: User["stripeSubscriptionId"]
) {
  return this.findOne({ stripeSubscriptionId })
}
interface QueryHelpers {
  findByEmail: AsQueryMethod<typeof findByEmail>
  findByEmailToken: AsQueryMethod<typeof findByEmailToken>
  findBySubscriptionId: AsQueryMethod<typeof findBySubscriptionId>
}

@pre<User>("save", async function () {
  if (!this.password) return
  if (!this.isModified("password")) return

  const salt = await bcrypt.genSalt(10)
  const hash = await bcrypt.hashSync(this.password, salt)

  this.password = hash
})
@index({ email: 1 })
@queryMethod(findByEmail)
@queryMethod(findByEmailToken)
@queryMethod(findBySubscriptionId)
@ObjectType()
export class User {
  @Field(() => String)
  _id: string

  @Field(() => String)
  @prop({ required: true })
  name: string

  @Field(() => String)
  @prop({ required: true })
  email: string

  @Field(() => String)
  @prop()
  phone?: string

  @Field(() => String)
  @prop()
  password?: string

  @Field(() => Role)
  @prop({
    default: Role.Patient,
    required: true,
  })
  role: Role

  @Field(() => String)
  @prop()
  emailToken?: string

  @Field(() => Date)
  @prop()
  emailTokenExpiresAt?: Date

  @Field(() => Date)
  @prop({ required: true })
  dateOfBirth: Date

  @Field(() => Address)
  @prop()
  address: Address

  @Field(() => [Weight])
  @prop({ default: [], required: true })
  weights: mongoose.Types.Array<Weight>

  @Field(() => Gender)
  @prop({ enum: Gender, type: String, required: true })
  gender: Gender

  @Field(() => Number)
  @prop({ required: true })
  heightInInches: number

  @Field(() => String)
  @prop()
  stripeCustomerId?: string

  @Field(() => String)
  @prop()
  stripeSubscriptionId?: string

  @Field(() => Date)
  @prop({ default: Date.now(), required: true })
  subscriptionExpiresAt: Date
}

export const UserModel = getModelForClass<typeof User, QueryHelpers>(User, {
  schemaOptions: { timestamps: true },
})
@InputType()
export class CreateUserInput {
  @Field(() => String)
  name: string

  @IsEmail({}, { message: emailValidation.message })
  @Field(() => String)
  email: string

  @IsPhoneNumber("US", { message: phoneValidation.message })
  @Field(() => String, { nullable: true })
  phone?: string

  @MinLength(password.length.minValue, {
    message: password.length.minMessage,
  })
  @MaxLength(password.length.maxValue, {
    message: password.length.maxMessage,
  })
  @Field(() => String, {
    nullable: true,
    description:
      "If no password is provided, an email will be sent to create one.",
  })
  password?: string

  @Field(() => Role, {
    nullable: true,
    description: "If no role is provided, defaults to Patient.",
  })
  role?: Role

  @IsDate({
    message: dateOfBirthValidation.message,
  })
  @MaxDate(
    new Date(
      `${new Date().getFullYear() - dateOfBirthValidation.minAge.value}-01-01`
    ),
    {
      message: dateOfBirthValidation.minAge.message,
    }
  )
  @Field(() => Date, {
    description: `User must be atleast ${dateOfBirthValidation.minAge.value} years old.`,
  })
  dateOfBirth: Date

  @Field(() => Address, {
    nullable: true,
    description:
      "If not provided, user will be assigned a task to provide this information.",
  })
  address?: Address

  @Field(() => Number, {
    nullable: true,
    description: "Current weight in lbs.",
  })
  weightInLbs?: number

  @Field(() => Gender)
  gender: Gender

  @Field(() => Number, { description: "Height in inches." })
  heightInInches: number

  @Field(() => String, {
    nullable: true,
    description: "If not provided, will be set after checkout.",
  })
  stripeCustomerId?: string

  @Field(() => String, {
    nullable: true,
    description: "If not provided, will be set after checkout.",
  })
  stripeSubscriptionId?: string

  @Field(() => Date, {
    nullable: true,
    description:
      "When the user's subscription expires. If not provided, the subscription won't be active.",
  })
  subscriptionExpiresAt?: Date
}

@InputType()
export class LoginInput {
  @IsEmail({}, { message: emailValidation.message })
  @Field(() => String)
  email: string

  @Field(() => String)
  password: string

  @Field(() => Boolean, {
    nullable: true,
    description: `If not set token will expire in ${normalExp}. If set to true, token will expire in ${rememberExp}.`,
  })
  remember: boolean

  @Field(() => Boolean, {
    nullable: true,
    description: "Only useable by admins to generate auth tokens",
  })
  noExpire?: boolean
}

@ObjectType()
export class LoginResponse {
  @Field(() => String, { nullable: true })
  message: string

  @Field(() => String)
  token: string

  @Field(() => User)
  user: User
}

@InputType()
export class ForgotPasswordInput {
  @IsEmail({}, { message: emailValidation.message })
  @Field(() => String)
  email: string
}

@InputType()
export class ResetPasswordInput {
  @Field(() => String)
  token: string

  @MinLength(password.length.minValue, {
    message: password.length.minMessage,
  })
  @MaxLength(password.length.maxValue, {
    message: password.length.maxMessage,
  })
  @Field(() => String)
  password: string

  @Field(() => Boolean)
  registration: boolean
}

@ObjectType()
export class MessageResponse {
  @Field(() => String)
  message: string
}

@InputType()
export class SubscribeEmailInput {
  @IsEmail({}, { message: emailValidation.message })
  @Field(() => String)
  email: string

  @Field(() => String)
  fullName: string

  @Field(() => String)
  location: string

  @Field(() => Boolean)
  waitlist: boolean

  @Field(() => Boolean)
  currentMember: boolean
}

@InputType()
export class UpdateSubscriptionInput {
  @Field(() => String)
  stripeSubscriptionId: string

  @Field(() => Date)
  subscriptionExpiresAt: Date
}

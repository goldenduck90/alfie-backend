import {
  getModelForClass,
  prop,
  pre,
  ReturnModelType,
  queryMethod,
  index,
} from "@typegoose/typegoose"
import { registerEnumType } from "type-graphql"
import { AsQueryMethod } from "@typegoose/typegoose/lib/types"
import bcrypt from "bcrypt"
import { IsEmail, MaxLength, MinLength } from "class-validator"
import { Field, InputType, ObjectType } from "type-graphql"
import config from "config"

const { email: emailValidation, password } = config.get("validations")

export enum Role {
  Patient = "PATIENT",
  Clinician = "CLINICIAN",
  Admin = "ADMIN",
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

function findBySignupToken(
  this: ReturnModelType<typeof User, QueryHelpers>,
  signupToken: User["signupToken"]
) {
  return this.findOne({ signupToken })
}

function findByResetPasswordToken(
  this: ReturnModelType<typeof User, QueryHelpers>,
  resetPasswordToken: User["resetPasswordToken"]
) {
  return this.findOne({ resetPasswordToken })
}

interface QueryHelpers {
  findByEmail: AsQueryMethod<typeof findByEmail>
  findBySignupToken: AsQueryMethod<typeof findBySignupToken>
  findByResetPasswordToken: AsQueryMethod<typeof findByResetPasswordToken>
}

@pre<User>("save", async function () {
  // check that the password is being modified
  if (!this.isModified("password")) {
    return
  }

  const salt = await bcrypt.genSalt(10)
  const hash = await bcrypt.hashSync(this.password, salt)

  this.password = hash
})
@index({ email: 1 })
@queryMethod(findByEmail)
@queryMethod(findBySignupToken)
@queryMethod(findByResetPasswordToken)
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
  password: string

  @Field(() => Role)
  @prop({
    default: Role.Patient,
    required: true,
  })
  role: Role

  @Field(() => Boolean)
  @prop({ default: false, required: true })
  emailVerified: boolean

  @Field(() => String)
  @prop()
  signupToken: string

  @Field(() => String)
  @prop()
  resetPasswordToken: string

  @Field(() => Date)
  @prop()
  resetPasswordTokenExpiresAt: Date

  @Field(() => Date)
  @prop({ default: Date.now() })
  createdAt: Date

  @Field(() => Date)
  @prop({ default: Date.now() })
  updatedAt: Date
}

export const UserModel = getModelForClass<typeof User, QueryHelpers>(User)

@InputType()
export class CreateUserInput {
  @Field(() => String)
  name: string

  @IsEmail({}, { message: emailValidation.message })
  @Field(() => String)
  email: string

  @MinLength(password.length.minValue, {
    message: password.length.minMessage,
  })
  @MaxLength(password.length.maxValue, {
    message: password.length.maxMessage,
  })
  @Field(() => String)
  password: string

  @Field(() => Role, { nullable: true })
  role: Role
}

@InputType()
export class LoginInput {
  @IsEmail({}, { message: emailValidation.message })
  @Field(() => String)
  email: string

  @Field(() => String)
  password: string

  @Field(() => Boolean, { nullable: true })
  remember: boolean
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

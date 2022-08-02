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

interface QueryHelpers {
  findByEmail: AsQueryMethod<typeof findByEmail>
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

  @prop({ required: true })
  password: string

  @Field(() => Role)
  @prop({
    default: Role.Patient,
    required: true,
  })
  role: Role
}

export const UserModel = getModelForClass<typeof User, QueryHelpers>(User)

@InputType()
export class CreateUserInput {
  @Field(() => String)
  name: string

  @IsEmail()
  @Field(() => String)
  email: string

  @MinLength(6, {
    message: "password must be at least 6 characters long",
  })
  @MaxLength(50, {
    message: "password must not be longer than 50 characters",
  })
  @Field(() => String)
  password: string

  @Field(() => Role, { nullable: true })
  role: Role
}

@InputType()
export class LoginInput {
  @Field(() => String)
  email: string

  @Field(() => String)
  password: string
}

@ObjectType()
export class LoginResponse {
  @Field(() => String)
  token: string

  @Field(() => User)
  user: User
}

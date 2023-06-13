import {
  getModelForClass,
  index,
  prop,
  queryMethod,
  ReturnModelType,
} from "@typegoose/typegoose"
import { AsQueryMethod } from "@typegoose/typegoose/lib/types"
import mongoose from "mongoose"
import { Field, InputType, Int, ObjectType } from "type-graphql"
import Role from "./enums/Role"

function findByEmail(
  this: ReturnModelType<typeof Provider, QueryHelpers>,
  email: Provider["email"]
) {
  return this.findOne({ email })
}

function findByEmailToken(
  this: ReturnModelType<typeof Provider, QueryHelpers>,
  emailToken: Provider["emailToken"]
) {
  return this.findOne({ emailToken })
}

interface QueryHelpers {
  findByEmail: AsQueryMethod<typeof findByEmail>
  findByEmailToken: AsQueryMethod<typeof findByEmailToken>
}
@queryMethod(findByEmail)
@queryMethod(findByEmailToken)
@ObjectType()
@index({ akuteId: 1, eaProviderId: 1, email: 1 }, { unique: true })
export class Provider {
  @Field(() => String)
  _id: string

  @Field(() => String)
  @prop({ enum: Role, type: String, required: true })
  type: Role

  @Field(() => String)
  @prop({ required: true })
  akuteId: string

  @Field(() => Int)
  @prop({ required: true })
  eaProviderId: number

  @Field(() => String)
  @prop({ required: true })
  npi: string

  @Field(() => [String])
  @prop({ type: [String], required: true })
  licensedStates: mongoose.Types.Array<string>

  @Field(() => String)
  @prop({ required: true })
  firstName: string

  @Field(() => String)
  @prop({ required: true })
  lastName: string

  @Field(() => String)
  @prop({ required: true })
  email: string

  @Field(() => Int, { nullable: true })
  @prop({ required: true, default: 0 })
  numberOfPatients: number

  @Field(() => String, { nullable: true })
  @prop()
  password?: string

  @Field(() => String, { nullable: true })
  @prop()
  emailToken?: string

  @Field(() => Date)
  @prop()
  emailTokenExpiresAt?: Date
}

export const ProviderModel = getModelForClass<typeof Provider>(Provider, {
  schemaOptions: { timestamps: true },
})

@InputType()
export class ProviderInput {
  @Field(() => Role)
  type: Role

  @Field(() => String)
  akuteId: string

  @Field(() => Int)
  eaProviderId: number

  @Field(() => String)
  npi: string

  @Field(() => [String])
  licensedStates: mongoose.Types.Array<string>

  @Field(() => String)
  firstName: string

  @Field(() => String)
  lastName: string

  @Field(() => String)
  email: string

  @Field(() => Int, { nullable: true, defaultValue: 0 })
  numberOfPatients: number
}

@InputType()
export class BatchCreateOrUpdateProvidersInput {
  @Field(() => [ProviderInput])
  providers: ProviderInput[]
}

@ObjectType()
export class BatchCreateOrUpdateProvidersResponse {
  @Field(() => Int)
  updated: number

  @Field(() => Int)
  created: number
}

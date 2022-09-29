import {
  Field,
  ObjectType,
  InputType,
  registerEnumType,
  Int,
} from "type-graphql"
import { getModelForClass, index, prop } from "@typegoose/typegoose"
import mongoose from "mongoose"

export enum ProviderType {
  Practitioner = "practitioner",
  Doctor = "doctor",
}

registerEnumType(ProviderType, {
  name: "ProviderType",
  description: "Represents whether the provider is a practitioner or doctor.",
})

@ObjectType()
@index({ akuteId: 1, eaProviderId: 1 }, { unique: true })
export class Provider {
  @Field(() => String)
  _id: string

  @Field(() => String)
  @prop({ enum: ProviderType, type: String, required: true })
  type: ProviderType

  @Field(() => String)
  @prop({ required: true })
  akuteId: string

  @Field(() => Int)
  @prop({ required: true })
  eaProviderId: number

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
}

export const ProviderModel = getModelForClass<typeof Provider>(Provider, {
  schemaOptions: { timestamps: true },
})

@InputType()
export class ProviderInput {
  @Field(() => ProviderType)
  type: ProviderType

  @Field(() => String)
  akuteId: string

  @Field(() => Int)
  eaProviderId: number

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

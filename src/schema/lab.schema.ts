import {
  Field,
  ObjectType,
  InputType,
  Int,
  registerEnumType,
  Float,
} from "type-graphql"
import { getModelForClass, index, prop } from "@typegoose/typegoose"

export enum LabCompany {
  LabCorp = "LabCorp",
}
registerEnumType(LabCompany, {
  name: "LabCompany",
  description: "The company of the lab",
})

@ObjectType()
@index({ faxNumber: 1 }, { unique: true })
export class Lab {
  @Field(() => String)
  _id: string

  @Field(() => String)
  @prop({ required: true })
  faxNumber: string

  @Field(() => String)
  @prop({ required: true })
  streetAddress: string

  @Field(() => String)
  @prop({ required: true })
  city: string

  @Field(() => String)
  @prop({ required: true })
  state: string

  @Field(() => String)
  @prop({ required: true })
  postalCode: string

  @Field(() => Float)
  @prop({ required: true })
  latitude: number

  @Field(() => Float)
  @prop({ required: true })
  longitude: number

  @Field(() => String)
  @prop({ required: true })
  name: string

  @Field(() => LabCompany)
  @prop({ required: true })
  company: LabCompany
}

@InputType()
export class LabInput {
  @Field(() => String)
  faxNumber: string

  @Field(() => String)
  streetAddress: string

  @Field(() => String)
  city: string

  @Field(() => String)
  state: string

  @Field(() => String)
  postalCode: string

  @Field(() => Float)
  latitude: number

  @Field(() => Float)
  longitude: number

  @Field(() => String)
  name: string

  @Field(() => LabCompany)
  company: LabCompany
}

export const LabModel = getModelForClass<typeof Lab>(Lab, {
  schemaOptions: { timestamps: true },
})

@InputType()
export class BatchCreateOrUpdateLabsInput {
  @Field(() => [LabInput])
  labs: LabInput[]
}

@ObjectType()
export class BatchCreateOrUpdateLabsResponse {
  @Field(() => Int)
  updated: number

  @Field(() => Int)
  created: number
}

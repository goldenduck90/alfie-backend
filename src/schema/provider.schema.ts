import { Field, ObjectType, InputType } from "type-graphql"
import { getModelForClass, prop } from "@typegoose/typegoose"
import mongoose from "mongoose"
import { String } from "aws-sdk/clients/appstream"
// drChronoId: 2,
//     eaPractitionerId: 2,
//         type: "practitioner",
//             validState: ["NY", "FL", "CO"],
//                 patients: ["62e99546efa6b0fc697d9d21", "62f6a5c89e1ea62d38310662", "62e99546efa6b0fc697d9d21"]

export enum ProviderType {
  Practitioner = "practitioner",
  Doctor = "doctor",
}
@ObjectType()
export class Provider {
  @Field(() => String)
  _id: string

  @Field(() => String)
  @prop({ enum: ProviderType, type: String, required: true })
  gender: ProviderType

  @Field(() => Number)
  @prop({ required: true })
  drChronoId: number

  @Field(() => Number)
  @prop({ required: true })
  eaPractitionerId: number

  // @Field(() => [String])
  // @prop({ type: [String], required: true })
  // validState: mongoose.Types.Array<string>

  // @Field(() => [String])
  // @prop({ type: [String], required: true })
  // patients: mongoose.Types.Array<string>
}

export const ProviderModel = getModelForClass<typeof Provider>(Provider, {
  schemaOptions: { timestamps: true },
})

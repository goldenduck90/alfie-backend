import { ModelOptions, getModelForClass, prop } from "@typegoose/typegoose"
import { Field, ObjectType } from "type-graphql"

@ObjectType()
@ModelOptions({
  schemaOptions: { _id: false, discriminatorKey: "metriportId" },
})
export class Facility {
  @Field(() => String)
  metriportId: string

  @Field(() => [String])
  @prop({ default: [], required: true })
  states: string[]
}

export const FacilityModel = getModelForClass<typeof Facility>(Facility)

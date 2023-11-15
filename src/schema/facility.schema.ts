import { ModelOptions, getModelForClass, prop } from "@typegoose/typegoose"
import { Field, ObjectType } from "type-graphql"

@ObjectType()
export class Facility {
  @Field(() => String)
  @prop()
  _id: string

  @Field(() => String)
  @prop({ required: true })
  metriportId: string

  @Field(() => [String])
  @prop({ default: [], required: true })
  states: string[]
}

export const FacilityModel = getModelForClass<typeof Facility>(Facility, {
  options: {
    customName: "facilities",
  },
})

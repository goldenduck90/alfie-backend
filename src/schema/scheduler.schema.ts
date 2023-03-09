import { Field, ObjectType } from "type-graphql"

@ObjectType()
export class CalAvailability {
  @Field(() => Number, { nullable: true })
  eventLength: number
  @Field(() => Number, { nullable: true })
  beforeEventBuffer: number
  @Field(() => Number, { nullable: true })
  afterEventBuffer: number
  @Field(() => Number, { nullable: true })
  minimumBookingNotice: number
}

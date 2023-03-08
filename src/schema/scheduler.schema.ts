import { Field, InputType, ObjectType } from "type-graphql"

@ObjectType()
export class CalAvailability {
  @Field(() => String)
  data: any
}

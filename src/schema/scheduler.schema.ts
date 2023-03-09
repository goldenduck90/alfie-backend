import { Field, ObjectType } from "type-graphql"

@ObjectType()
export class CalAvailability {
  @Field(() => String)
  availability: string
}

import { Field, ObjectType } from "type-graphql"
import { Insurance } from "./user.schema"

@ObjectType()
export class InsuranceTextractResponse {
  @Field(() => [Insurance])
  insuranceMatches: Insurance[]

  @Field(() => [String])
  words: string[]

  @Field(() => [String])
  lines: string[]
}

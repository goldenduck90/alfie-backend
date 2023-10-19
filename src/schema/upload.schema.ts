import { Field, ObjectType } from "type-graphql"
import { InsuranceType } from "./insurance.schema"

@ObjectType()
export class InsuranceTextractDetails {
  @Field(() => InsuranceType, { nullable: true })
  type?: InsuranceType

  @Field(() => String, { nullable: true })
  memberId?: string

  @Field(() => String, { nullable: true })
  groupId?: string
}

@ObjectType()
export class InsuranceTextractResponse {
  @Field(() => InsuranceTextractDetails, { nullable: true })
  insurance?: InsuranceTextractDetails

  @Field(() => [String])
  words: string[]

  @Field(() => [String])
  lines: string[]
}

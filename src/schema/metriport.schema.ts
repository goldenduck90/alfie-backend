import { Field, ObjectType } from "type-graphql"

@ObjectType()
export class MetriportConnectResponse {
  @Field()
  url: string
}

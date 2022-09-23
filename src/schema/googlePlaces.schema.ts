import { Field, InputType, ObjectType } from "type-graphql"

@InputType()
export class GooglePlacesSearchInput {
  @Field(() => String)
  query: string

  @Field(() => String)
  location: string

  @Field(() => Number)
  radius: number

  @Field(() => String)
  type: string
}
@ObjectType()
export class GooglePlacesSearchResult {
  @Field(() => String)
  description: string

  @Field(() => String)
  place_id: string

  @Field(() => String)
  reference: string
}

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
@ObjectType()
export class LocationObject {
  @Field(() => Number)
  lat: number

  @Field(() => Number)
  lng: number
}
@ObjectType()
export class GoogleReverseGeoCodeGeometryObject {
  @Field(() => LocationObject)
  location: LocationObject
}

@ObjectType()
export class GoogleReverseGeoCodeResult {
  @Field(() => String)
  formatted_address: string

  @Field(() => GoogleReverseGeoCodeGeometryObject)
  geometry: GoogleReverseGeoCodeGeometryObject
}

@InputType()
export class GoogleReverseGeoCodeInput {
  @Field(() => String)
  city: string

  @Field(() => String)
  state: string

  @Field(() => String)
  line1: string

  @Field(() => String)
  postalCode: string
}

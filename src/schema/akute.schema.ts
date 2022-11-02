import { Field, InputType, ObjectType } from "type-graphql"

@InputType()
export class PharmacyLocationInput {
  @Field()
  name: string

  // @Field()
  // address: string;

  // @Field()
  // city: string;

  // @Field()
  // state: string;

  // @Field()
  // zip: string;

  // @Field()
  // phoneOrFax: string;
}

@ObjectType()
export class PharmacyLocationResult {
  @Field()
  id: number

  @Field()
  name: string

  @Field()
  address_line_1: string

  @Field(() => String, { nullable: true })
  address_line_2: string

  @Field()
  address_city: string

  @Field()
  address_state: string

  @Field()
  address_zipcode: string

  @Field()
  primary_phone_number: string

  @Field()
  primary_fax_number: string

  @Field(() => [String])
  pharmacy_specialties: string[]

  @Field(() => Number, { nullable: true })
  lat: number

  @Field(() => Number, { nullable: true })
  lng: number
}

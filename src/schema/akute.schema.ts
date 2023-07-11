import { Field, InputType, ObjectType } from "type-graphql"

@InputType()
export class PharmacyLocationInput {
  @Field()
  name: string
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

@ObjectType()
export class CreateLabOrderResponse {
  @Field(() => String)
  labOrderId: string
}

@InputType()
export class DocUploadInput {
  @Field(() => String)
  file: string

  @Field(() => String)
  fileName: string

  @Field(() => String, { nullable: true })
  description?: string

  @Field(() => String, { nullable: true })
  externalPatientId?: string

  @Field(() => String, { nullable: true })
  patientId?: string

  @Field(() => [String])
  tags?: string[]
}

@ObjectType()
export class AkuteDocument {
  @Field(() => String)
  id: string
}

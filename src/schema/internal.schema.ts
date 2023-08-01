import { Insurance } from "./user.schema"
import { Field, InputType } from "type-graphql"

// Input Types
@InputType()
export class PatientReassignInput {
  @Field()
  patientId: string

  @Field()
  newProviderId: string
}

@InputType()
export class BulkPatientReassignInput {
  @Field(() => [String])
  patientIds: string[]

  @Field()
  newProviderId: string
}

@InputType()
export class PatientModifyInput {
  @Field()
  patientId: string

  @Field()
  name: string

  @Field()
  dateOfBirth: Date

  @Field()
  email: string

  @Field()
  phoneNumber: string

  @Field()
  gender: string

  @Field()
  address: string

  @Field()
  city: string

  @Field()
  state: string

  @Field()
  zip: string

  @Field()
  insurance: Insurance
}

@InputType()
export class ProviderModifyInput {
  @Field()
  providerId: string

  @Field()
  firstName: string

  @Field()
  lastName: string

  @Field()
  email: string

  @Field()
  npi: string

  @Field(() => [String])
  licensedStates: string[]

  @Field()
  providerCode: string
}

@InputType()
export class ProviderCreateInput {
  @Field()
  firstName: string

  @Field()
  lastName: string

  @Field()
  email: string

  @Field()
  npi: string

  @Field(() => [String])
  licensedStates: string[]

  @Field()
  providerCode: string
}

import { Field, InputType, ObjectType } from "type-graphql"
import { Role } from "./user.schema"

@InputType()
export class AllTimeslotsInput {
  @Field(() => Date)
  selectedDate: Date

  @Field(() => String)
  eaServiceId: string

  @Field(() => Role, { nullable: true, defaultValue: Role.Practitioner })
  providerType: Role
}

@ObjectType()
export class EAService {
  @Field(() => String)
  id: string

  @Field(() => String)
  name: string

  @Field(() => Number)
  durationInMins: number

  @Field(() => String, { nullable: true })
  description?: string
}

@ObjectType()
export class TimeslotsResponse {
  @Field(() => Date)
  selectedDateInUtc: Date

  @Field(() => Number)
  total: number

  @Field(() => EAService)
  eaService: EAService

  @Field(() => [Timeslot])
  timeslots: Timeslot[]
}

@ObjectType()
export class EAProvider {
  @Field(() => String)
  id: string

  @Field(() => String)
  name: string

  @Field(() => String)
  email: string

  @Field(() => Role)
  type: Role

  @Field(() => Number, { nullable: true })
  numberOfPatients?: number
}

@ObjectType()
export class Timeslot {
  @Field(() => Date)
  startTimeInUtc: Date

  @Field(() => Date)
  endTimeInUtc: Date

  @Field(() => EAProvider)
  eaProvider: EAProvider
}

@InputType()
export class ProviderTimeslotsInput {
  @Field(() => String)
  eaProviderId: string

  @Field(() => String)
  eaServiceId: string

  @Field(() => Date)
  selectedDate: Date
}

@InputType()
export class CreateCustomerInput {
  @Field(() => String)
  userId: string

  @Field(() => String)
  firstName: string

  @Field(() => String)
  lastName: string

  @Field(() => String)
  email: string

  @Field(() => String)
  phone: string

  @Field(() => String)
  address: string

  @Field(() => String)
  city: string

  @Field(() => String)
  state: string

  @Field(() => String)
  zipCode: string

  @Field(() => String, { nullable: true })
  notes?: string

  @Field(() => Boolean, { nullable: true })
  updateUser?: boolean
}

@InputType()
export class CreateAppointmentInput {
  @Field(() => Role)
  providerType: Role

  @Field(() => String)
  eaServiceId: string

  @Field(() => String)
  eaProviderId: string

  @Field(() => Date)
  startTimeInUtc: Date

  @Field(() => Date)
  endTimeInUtc: Date

  @Field(() => String, { nullable: true })
  notes?: string
}

@InputType()
export class UpdateAppointmentInput {
  @Field(() => String)
  eaAppointmentId: string

  @Field(() => Role)
  providerType: Role

  @Field(() => String)
  eaServiceId: string

  @Field(() => String)
  eaProviderId: string

  @Field(() => Date)
  startTimeInUtc: Date

  @Field(() => Date)
  endTimeInUtc: Date

  @Field(() => String, { nullable: true })
  notes?: string
}

@ObjectType()
export class EAAppointment {
  @Field(() => String)
  eaAppointmentId: string

  @Field(() => EAService)
  eaService: string

  @Field(() => EAProvider)
  eaProvider: EAProvider

  @Field(() => Date)
  startTimeInUtc: Date

  @Field(() => Date)
  endTimeInUtc: Date

  @Field(() => String)
  location: string

  @Field(() => String, { nullable: true })
  notes?: string
}
@ObjectType()
export class EACustomer {
  @Field(() => String, { nullable: true })
  name: string

  @Field(() => String)
  email: string

  @Field(() => String)
  phone: string
}
@ObjectType()
export class EAAppointmentWithCustomer extends EAAppointment {
  @Field(() => EACustomer)
  eaCustomer: EACustomer
}

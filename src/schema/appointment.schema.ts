import { Field, InputType, ObjectType } from "type-graphql"
import {
  Break,
  Day,
  IEAProvider,
  Settings,
  WorkingPlan,
} from "./../@types/easyAppointmentTypes"
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

  @Field(() => String, { nullable: true })
  timezone?: string
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

@ObjectType()
@InputType("EAProviderProfileWorkingPlanBreakInput")
export class EAWorkingPlanBreak implements Break {
  @Field(() => String, { nullable: true })
  start?: string

  @Field(() => String, { nullable: true })
  end?: string
}
@ObjectType()
@InputType("EAProviderProfileWorkingPlanDayInput")
export class EAWorkingPlanDay implements Day {
  @Field(() => String, { nullable: true })
  start?: string

  @Field(() => String, { nullable: true })
  end?: string

  @Field(() => [EAWorkingPlanBreak], { nullable: true })
  breaks?: EAWorkingPlanBreak[]
}
@ObjectType()
@InputType("EAProviderProfileWorkingPlanInput")
export class EAWorkingPlan implements WorkingPlan {
  @Field(() => EAWorkingPlanDay, { nullable: true })
  monday?: EAWorkingPlanDay

  @Field(() => EAWorkingPlanDay, { nullable: true })
  tuesday?: EAWorkingPlanDay

  @Field(() => EAWorkingPlanDay, { nullable: true })
  wednesday?: EAWorkingPlanDay

  @Field(() => EAWorkingPlanDay, { nullable: true })
  thursday?: EAWorkingPlanDay

  @Field(() => EAWorkingPlanDay, { nullable: true })
  friday?: EAWorkingPlanDay

  @Field(() => EAWorkingPlanDay, { nullable: true })
  saturday?: EAWorkingPlanDay

  @Field(() => EAWorkingPlanDay, { nullable: true })
  sunday?: EAWorkingPlanDay
}

@ObjectType()
@InputType("EAProviderProfileSettingsInput")
export class EAProviderSettings implements Settings {
  @Field(() => EAWorkingPlan, { nullable: true })
  workingPlan?: EAWorkingPlan
}
@ObjectType()
@InputType("EAProviderProfileInput")
export class EAProviderProfile implements IEAProvider {
  @Field(() => String, { nullable: true })
  firstName?: string

  @Field(() => EAProviderSettings, { nullable: true })
  settings?: EAProviderSettings
}

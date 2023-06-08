import { Field, InputType, ObjectType } from "type-graphql"
import {
  Break,
  Day,
  IEAProvider,
  Settings,
  WorkingPlan,
} from "./../@types/easyAppointmentTypes"
import Role from "./enums/Role"

@ObjectType()
@InputType("TimeBlockInput")
class TimeBlock {
  @Field()
  start: string

  @Field()
  end: string
}

@ObjectType()
@InputType("BreakInput")
class ScheduleBreak extends TimeBlock {}

@ObjectType()
@InputType("DailyScheduleInput")
class DailySchedule extends TimeBlock {
  @Field(() => [ScheduleBreak])
  breaks: ScheduleBreak[]
}

@InputType("ScheduleInput")
@ObjectType()
export class Schedule {
  @Field(() => DailySchedule)
  monday: DailySchedule

  @Field(() => DailySchedule)
  tuesday: DailySchedule

  @Field(() => DailySchedule)
  wednesday: DailySchedule

  @Field(() => DailySchedule)
  thursday: DailySchedule

  @Field(() => DailySchedule)
  friday: DailySchedule

  @Field(() => DailySchedule)
  saturday: DailySchedule

  @Field(() => DailySchedule)
  sunday: DailySchedule
}

@InputType("ScheduleExceptionsInput")
@ObjectType()
class ScheduleExceptions {
  @Field(() => DailySchedule)
  date: DailySchedule
}
@ObjectType()
export class ScheduleObject {
  @Field()
  timezone: string

  @Field(() => Schedule)
  schedule: Schedule

  @Field(() => ScheduleExceptions)
  exceptions: ScheduleExceptions
}

@ObjectType()
export class UpdateScheduleMessage {
  @Field()
  code: number

  @Field()
  message: string
}

@InputType("ScheduleInput2")
@ObjectType()
export class ScheduleObjectInput {
  @Field()
  timezone: string

  @Field(() => Schedule)
  schedule: Schedule
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

  @Field(() => String)
  timezone: string

  @Field(() => Number)
  minAdvancedNotice: number

  @Field(() => Number)
  bufferTime: number
}

@ObjectType()
export class EACustomer {
  @Field(() => String)
  id: string

  @Field(() => String)
  name: string

  @Field(() => String)
  email: string

  @Field(() => String)
  phone: string
}

@ObjectType()
export class TimeslotsResponse {
  @Field(() => String)
  selectedDate: string

  @Field(() => Number)
  total: number

  @Field(() => String)
  timezone: string

  @Field(() => EAService)
  eaService: EAService

  @Field(() => EAProvider)
  eaProvider: EAProvider

  @Field(() => EACustomer, { nullable: true })
  eaCustomer?: boolean

  @Field(() => [Timeslot])
  timeslots: Timeslot[]
}

@ObjectType()
export class Timeslot {
  @Field(() => String)
  start: string

  @Field(() => String)
  end: string
}

@InputType()
export class GetTimeslotsInput {
  @Field(() => String)
  selectedDate: string

  @Field(() => String)
  timezone: string

  @Field(() => String, { nullable: true })
  appointmentId?: string

  @Field(() => Boolean, { defaultValue: false })
  bypassNotice: boolean

  @Field(() => String, { nullable: true })
  userId?: string
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

  @Field(() => String)
  timezone: string

  @Field(() => String, { nullable: true })
  notes?: string

  @Field(() => Boolean, { nullable: true })
  updateUser?: boolean
}

@InputType()
export class CreateAppointmentInput {
  @Field(() => String, { nullable: true })
  userId?: string

  @Field(() => String)
  start: string

  @Field(() => String)
  end: string

  @Field(() => String)
  timezone: string

  @Field(() => Boolean, { defaultValue: false })
  bypassNotice: boolean

  @Field(() => String, { nullable: true })
  notes?: string

  @Field(() => String, { nullable: true })
  userTaskId?: string
}

@InputType()
export class UpdateAppointmentInput {
  @Field(() => String)
  eaAppointmentId: string

  @Field(() => String)
  start: string

  @Field(() => String)
  end: string

  @Field(() => String)
  timezone: string

  @Field(() => String, { nullable: true })
  notes?: string

  @Field(() => Boolean, { defaultValue: false })
  bypassNotice: boolean
}

@InputType()
export class GetAppointmentInput {
  @Field(() => String)
  eaAppointmentId: string

  @Field(() => String)
  timezone: string
}

@InputType()
export class UpcomingAppointmentsInput {
  @Field(() => String, { nullable: true })
  selectedDate?: string

  @Field(() => String)
  timezone: string
}

@InputType()
export class GetAppointmentsByMonthInput {
  @Field(() => Number)
  month: number

  @Field(() => String)
  timezone: string
}

@InputType()
export class GetAppointmentsByDateInput {
  @Field(() => String)
  selectedDate: string

  @Field(() => String)
  timezone: string
}

@ObjectType()
export class EAAppointment {
  @Field(() => String)
  eaAppointmentId: string

  @Field(() => EAService)
  eaService: string

  @Field(() => EAProvider)
  eaProvider: EAProvider

  @Field(() => String)
  start: string

  @Field(() => String)
  end: string

  @Field(() => String)
  location: string

  @Field(() => String, { nullable: true })
  notes?: string

  @Field(() => EACustomer)
  eaCustomer: EACustomer

  @Field(() => Boolean)
  attendanceEmailSent: boolean

  @Field(() => Boolean)
  claimSubmitted: boolean

  @Field(() => Boolean)
  patientAttended: boolean

  @Field(() => Boolean)
  providerAttended: boolean
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

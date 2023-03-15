import { Field, InputType, ObjectType, registerEnumType } from "type-graphql"

enum Status {
  ACCEPTED = "ACCEPTED",
  PENDING = "PENDING",
  CANCELLED = "CANCELLED",
  REJECTED = "REJECTED",
}
registerEnumType(Status, {
  name: "Status",
})

@ObjectType()
export class Attendee {
  @Field(() => String, { nullable: true })
  name: string
  @Field(() => String, { nullable: true })
  email: string
  @Field(() => String, { nullable: true })
  timeZone: string
  @Field(() => String, { nullable: true })
  locale: string
}

@ObjectType()
export class CalTimeslot {
  @Field(() => Number, { nullable: true })
  day: number
  @Field(() => String)
  start: string
  @Field(() => String)
  end: string
}

@ObjectType()
export class Availability {
  @Field(() => Number, { nullable: true })
  id: number
  @Field(() => Number, { nullable: true })
  eventTypeId: number
  @Field(() => [Number], { nullable: true })
  days: number[]
  @Field(() => String, { nullable: true })
  startTime: string
  @Field(() => String, { nullable: true })
  endTime: string
}

ObjectType()
enum CustomInputType {
  TEXT = "TEXT",
  TEXTLONG = "TEXTLONG",
  NUMBER = "NUMBER",
  BOOL = "BOOL",
  RADIO = "RADIO",
  PHONE = "PHONE",
}

ObjectType()
export class CustomOptions {
  @Field(() => String, { nullable: true })
  label: string
  @Field(() => String, { nullable: true })
  type: string
}

ObjectType()
export class CustomInput {
  @Field(() => Number)
  eventTypeId: number
  @Field(() => String)
  label: string
  @Field(() => CustomInputType)
  type: CustomInputType
  @Field(() => CustomOptions)
  options: CustomOptions
  @Field(() => Boolean)
  required: boolean
  @Field(() => String)
  placeholder: string
}

@InputType()
@ObjectType()
export class BookingInput {
  @Field(() => Number)
  id?: number
  @Field(() => String)
  title: string
  @Field(() => String)
  startTime: string
  @Field(() => String)
  endTime: string
  @Field(() => Number)
  eventTypeId: number
  @Field(() => String)
  eventTypeSlug: number
  @Field(() => [CustomInput])
  customInput: CustomInput[]
  @Field(() => String, { nullable: true })
  recurringEventId: number
  @Field(() => String, { nullable: true })
  description: string
  @Field(() => String, { nullable: true })
  notes: string
  @Field(() => Status)
  status: Status
  @Field(() => String, { nullable: true })
  user: CalUser
  @Field(() => String, { nullable: true })
  location: string
  @Field(() => String, { nullable: true })
  language: string
  @Field(() => String, { nullable: true })
  smsReminderNumber: string
  @Field(() => Boolean)
  hasHashedBookingLink: boolean
  @Field(() => String, { nullable: true })
  hashedLink: string
  @Field(() => Attendee)
  attendees: Attendee[]
}

@ObjectType()
export class BookingResponse {
  @Field(() => Number)
  id: number
  @Field(() => String)
  uid: string
  @Field(() => Number)
  userId: number
  @Field(() => String)
  title: string
  @Field(() => String)
  startTime: string
  @Field(() => String)
  endTime: string
  @Field(() => Number)
  eventTypeId: number
  @Field(() => [CustomInput])
  customInput: CustomInput[]
  @Field(() => String, { nullable: true })
  recurringEventId: number
  @Field(() => String, { nullable: true })
  cancellationReason: string
  @Field(() => String, { nullable: true })
  destinationCalendarId: string
  @Field(() => String, { nullable: true })
  dynamicEventSlugRef: string
  @Field(() => String, { nullable: true })
  dynamicGroupSlugRef: string
  @Field(() => Boolean, { nullable: true })
  rescheduled: boolean
  @Field(() => Boolean, { nullable: true })
  fromReschedule: boolean
  @Field(() => String, { nullable: true })
  rejectionReason: string
  @Field(() => String, { nullable: true })
  description: string
  @Field(() => Status)
  status: Status
  @Field(() => Boolean)
  paid: boolean
  @Field(() => CalUser)
  user: CalUser
  @Field(() => String, { nullable: true })
  location: string
  @Field(() => String, { nullable: true })
  language: string
  @Field(() => String, { nullable: true })
  smsReminderNumber: string
  @Field(() => Boolean)
  hasHashedBookingLink: boolean
  @Field(() => String, { nullable: true })
  hashedLink: string
  @Field(() => Attendee)
  attendees: Attendee[]
}

@ObjectType()
export class EventType {
  @Field(() => Number, { nullable: true })
  length: number
  @Field(() => Number, { nullable: true })
  beforeEventBuffer: number
  @Field(() => Number, { nullable: true })
  afterEventBuffer: number
  @Field(() => Number, { nullable: true })
  minimumBookingNotice: number
}
@ObjectType()
export class Schedule {
  @Field(() => Number)
  id: number
  @Field(() => Number)
  userId: number
  @Field(() => String)
  name: string
  @Field(() => String, { nullable: true })
  timeZone: string
  @Field(() => [Availability], { nullable: true })
  availability: Availability
}

@ObjectType()
export class EventBusyDetails {
  @Field(() => String, { nullable: true })
  start: string
  @Field(() => String, { nullable: true })
  end: string
  @Field(() => String, { nullable: true })
  title?: string
  @Field(() => String, { nullable: true })
  source?: string | null
}

@InputType()
export class ScheduleAvailability {
  @Field(() => Number)
  scheduleId: number
  @Field(() => [Number])
  days: number[]
  @Field(() => String)
  startTime: string
  @Field(() => String)
  endTime: string
}
@InputType()
export class ProviderAvailabilityInput {
  @Field(() => String)
  email?: string
  @Field(() => String, { nullable: true })
  dateFrom?: string
  @Field(() => String, { nullable: true })
  dateTo?: string
  @Field(() => String)
  timezone: string
}

@ObjectType()
export class CalAvailability {
  @Field(() => [CalTimeslot], { nullable: true })
  availabilities: CalTimeslot[]
  @Field(() => [EventBusyDetails], { nullable: true })
  busy: EventBusyDetails[]
  @Field(() => String, { nullable: true })
  timeZone?: string
  @Field(() => Number, { nullable: true })
  minimumBookingNotice?: number
}

@ObjectType()
export class CalUser {
  @Field(() => String)
  email: string
  @Field(() => String)
  username?: string
  @Field(() => String)
  timeZone?: string
}

import { Field, InputType, ObjectType, registerEnumType } from "type-graphql"

enum Status {
  ACCEPTED = "ACCEPTED",
  PENDING = "PENDING",
  CANCELLED = "CANCELLED",
  REJECTED = "REJECTED",
}
enum CustomInputType {
  TEXT = "TEXT",
  TEXTLONG = "TEXTLONG",
  NUMBER = "NUMBER",
  BOOL = "BOOL",
  RADIO = "RADIO",
  PHONE = "PHONE",
}

registerEnumType(CustomInputType, {
  name: "CustomInputType",
})
registerEnumType(Status, {
  name: "Status",
})

@InputType()
@ObjectType()
export class Attendee {
  @Field(() => String)
  name: string
  @Field(() => String)
  email: string
  @Field(() => String)
  timeZone: string
  @Field(() => String, { nullable: true })
  locale?: string
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
  @Field(() => Number)
  id: number
  @Field(() => Number)
  eventTypeId: number
  @Field(() => [Number])
  days: number[]
  @Field(() => String)
  startTime: string
  @Field(() => String)
  endTime: string
}

@InputType()
export class Options {
  @Field(() => String, { nullable: true })
  label: string
  @Field(() => String, { nullable: true })
  type: string
}

@InputType()
export class CustomInput {
  @Field(() => Number)
  eventTypeId: number
  @Field(() => String)
  label: string
  @Field(() => CustomInputType)
  type: CustomInputType
  @Field(() => Options, { nullable: true })
  options: Options
  @Field(() => Boolean)
  required: boolean
  @Field(() => String)
  placeholder: string
}

@ObjectType()
export class CalUser {
  @Field(() => String, { nullable: true })
  email?: string
  @Field(() => String, { nullable: true })
  username?: string
  @Field(() => String, { nullable: true })
  timeZone?: string
}

@ObjectType()
export class EventType {
  @Field(() => Number, { nullable: true })
  length: number
  @Field(() => Number, { nullable: true })
  beforeEventBuffer?: number
  @Field(() => Number, { nullable: true })
  afterEventBuffer?: number
  @Field(() => Number, { nullable: true })
  minimumBookingNotice?: number
}

@ObjectType()
export class EventBusyDetails {
  @Field(() => String)
  start: string
  @Field(() => String)
  end: string
  @Field(() => String)
  title: string
  @Field(() => String, { nullable: true })
  source?: string | null
}

@InputType()
export class BookingInput {
  @Field(() => Number)
  id?: number
  @Field(() => String)
  title?: string
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
  @Field(() => String)
  recurringEventId?: number
  @Field(() => String)
  description?: string
  @Field(() => String)
  notes?: string
  @Field(() => Status)
  status?: Status
  @Field(() => String)
  user: CalUser
  @Field(() => String)
  location?: string
  @Field(() => String, { nullable: true })
  language?: string
  @Field(() => String, { nullable: true })
  smsReminderNumber?: string
  @Field(() => Boolean)
  hasHashedBookingLink?: boolean
  @Field(() => String, { nullable: true })
  hashedLink?: string
  @Field(() => Attendee)
  attendees?: Attendee[]
}

@ObjectType()
export class BookingResponse {
  @Field(() => Number, { nullable: true })
  id: number
  @Field(() => String, { nullable: true })
  uid: string
  @Field(() => Number, { nullable: true })
  userId: number
  @Field(() => String, { nullable: true })
  title: string
  @Field(() => String, { nullable: true })
  startTime: string
  @Field(() => String, { nullable: true })
  endTime: string
  @Field(() => Number, { nullable: true })
  eventTypeId: number
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
  @Field(() => Status, { nullable: true })
  status: Status
  @Field(() => Boolean, { nullable: true })
  paid: boolean
  @Field(() => CalUser, { nullable: true })
  user: CalUser
  @Field(() => String, { nullable: true })
  location: string
  @Field(() => String, { nullable: true })
  language: string
  @Field(() => String, { nullable: true })
  smsReminderNumber: string
  @Field(() => Boolean, { nullable: true })
  hasHashedBookingLink: boolean
  @Field(() => String, { nullable: true })
  hashedLink: string
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
  @Field(() => [EventBusyDetails])
  busy: EventBusyDetails[]
  @Field(() => String)
  timeZone: string
  @Field(() => Number)
  minimumBookingNotice: number
}

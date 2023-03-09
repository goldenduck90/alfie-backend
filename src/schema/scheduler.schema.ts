import { Field, ObjectType, registerEnumType } from "type-graphql"

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

@ObjectType()
export class Booking {
  @Field(() => String)
  title: string
  @Field(() => String)
  startTime: string
  @Field(() => String)
  endTime: string
  @Field(() => String, { nullable: true })
  recurringEventId: number
  @Field(() => String, { nullable: true })
  description: string
  @Field(() => Status)
  status: Status
  @Field(() => String)
  location: string
  @Field(() => String, { nullable: true })
  smsReminderNumber: string
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
export class CalAvailability {
  @Field(() => Schedule, { nullable: true })
  schedule: Schedule
  // @Field(() => [Booking], { nullable: true })
  // bookings: Booking[]
  @Field(() => EventType, { nullable: true })
  eventType: EventType
}

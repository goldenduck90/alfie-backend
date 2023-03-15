import CalSchedulerService from "../services/scheduler.service"
import { Arg, Authorized, Ctx, Mutation, Query, Resolver } from "type-graphql"
import { Role } from "../schema/user.schema"
import {
  BookingInput,
  BookingResponse,
  CalAvailability,
  ProviderAvailabilityInput,
  ScheduleAvailability,
} from "../schema/scheduler.schema"
import Context from "../types/context"

@Resolver()
export default class SchedulerResolver {
  constructor(private calSchedulerService: CalSchedulerService) {
    this.calSchedulerService = new CalSchedulerService()
  }

  @Authorized([Role.Practitioner, Role.Admin, Role.HealthCoach])
  @Query(() => CalAvailability)
  getProviderAvailability(
    @Ctx() context: Context,
    @Arg("input") input: ProviderAvailabilityInput
  ) {
    return this.calSchedulerService.getProviderAvailability(
      context.user.email,
      input.dateFrom,
      input.dateTo,
      context.user.timezone
    )
  }

  @Authorized([Role.Practitioner, Role.Admin, Role.HealthCoach])
  @Mutation(() => CalAvailability)
  createScheduleAvailability(
    @Ctx() context: Context,
    @Arg("input") input: ScheduleAvailability
  ) {
    return this.calSchedulerService.createScheduleAvailability(input)
  }

  @Authorized([Role.Practitioner, Role.Admin, Role.HealthCoach])
  @Mutation(() => BookingResponse)
  createBooking(@Arg("input") input: BookingInput) {
    return this.calSchedulerService.createBooking(input)
  }

  @Authorized([Role.Practitioner, Role.Admin, Role.HealthCoach])
  @Query(() => CalAvailability)
  getScheduleAvailabilityById(@Arg("id") id: number) {
    return this.calSchedulerService.getScheduleAvailabilityById(id)
  }

  @Authorized([Role.Practitioner, Role.Admin, Role.HealthCoach])
  @Mutation(() => CalAvailability)
  updateScheduleAvailability(@Arg("id") id: number) {
    return this.calSchedulerService.updateScheduleAvailability(id)
  }

  @Authorized([Role.Practitioner, Role.Admin, Role.HealthCoach])
  @Mutation(() => BookingResponse)
  updateBooking(@Arg("input") input: BookingInput) {
    return this.calSchedulerService.updateBooking(input)
  }

  @Authorized([Role.Practitioner, Role.Admin, Role.HealthCoach])
  @Mutation(() => CalAvailability)
  deleteBooking(@Arg("id") id: number) {
    return this.calSchedulerService.deleteBooking(id)
  }
}

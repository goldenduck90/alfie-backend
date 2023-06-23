import {
  Schedule,
  ScheduleObject,
  UpdateScheduleMessage,
} from "./../schema/appointment.schema"
import { Arg, Authorized, Ctx, Mutation, Query, Resolver } from "type-graphql"
import {
  CreateAppointmentInput,
  CreateCustomerInput,
  EAAppointment,
  EAProviderProfile,
  GetAppointmentInput,
  GetAppointmentsByDateInput,
  GetAppointmentsByMonthInput,
  GetTimeslotsInput,
  TimeslotsResponse,
  UpcomingAppointmentsInput,
  UpdateAppointmentInput,
} from "../schema/appointment.schema"
import { MessageResponse } from "../schema/user.schema"
import Role from "../schema/enums/Role"
import AppointmentService from "../services/appointment.service"
import Context from "../types/context"

@Resolver()
export default class AppointmentResolver {
  constructor(private appointmentService: AppointmentService) {
    this.appointmentService = new AppointmentService()
  }

  @Authorized([
    Role.Patient,
    Role.Practitioner,
    Role.Doctor,
    Role.CareCoordinator,
    Role.HealthCoach,
    Role.Nutritionist,
  ])
  @Query(() => TimeslotsResponse)
  timeslots(@Ctx() context: Context, @Arg("input") input: GetTimeslotsInput) {
    return this.appointmentService.getTimeslots(context.user, input)
  }

  @Authorized([
    Role.Patient,
    Role.Practitioner,
    Role.Doctor,
    Role.CareCoordinator,
    Role.HealthCoach,
    Role.Nutritionist,
  ])
  @Query(() => EAAppointment)
  appointment(@Arg("input") input: GetAppointmentInput) {
    return this.appointmentService.getAppointment(input)
  }

  @Authorized([
    Role.Patient,
    Role.Practitioner,
    Role.Doctor,
    Role.CareCoordinator,
    Role.HealthCoach,
    Role.Nutritionist,
  ])
  @Query(() => [EAAppointment])
  appointmentsByDate(
    @Ctx() context: Context,
    @Arg("input") input: GetAppointmentsByDateInput
  ) {
    return this.appointmentService.getAppointmentsByDate(context.user, input)
  }

  @Authorized([
    Role.Patient,
    Role.Practitioner,
    Role.Doctor,
    Role.CareCoordinator,
    Role.HealthCoach,
    Role.Nutritionist,
  ])
  @Query(() => [EAAppointment])
  appointmentsByMonth(
    @Ctx() context: Context,
    @Arg("input") input: GetAppointmentsByMonthInput
  ) {
    return this.appointmentService.getAppointmentsByMonth(context.user, input)
  }

  @Authorized([
    Role.Patient,
    Role.Practitioner,
    Role.Doctor,
    Role.CareCoordinator,
    Role.HealthCoach,
    Role.Nutritionist,
  ])
  @Query(() => [EAAppointment])
  upcomingAppointments(
    @Ctx() context: Context,
    @Arg("input") input: UpcomingAppointmentsInput
  ) {
    return this.appointmentService.upcomingAppointments(context.user, input)
  }

  @Authorized([
    Role.Patient,
    Role.Practitioner,
    Role.Doctor,
    Role.CareCoordinator,
    Role.HealthCoach,
    Role.Nutritionist,
  ])
  @Mutation(() => EAAppointment)
  updateAppointment(@Arg("input") input: UpdateAppointmentInput) {
    return this.appointmentService.updateAppointment(input)
  }

  @Authorized([
    Role.Patient,
    Role.Practitioner,
    Role.Doctor,
    Role.CareCoordinator,
    Role.HealthCoach,
    Role.Nutritionist,
  ])
  @Mutation(() => MessageResponse)
  updateAppointmentAttended(
    @Ctx() context: Context,
    @Arg("eaAppointmentId") eaAppointmentId: string
  ) {
    return this.appointmentService.updateAppointmentAttended(
      context.user,
      eaAppointmentId
    )
  }

  @Authorized([
    Role.Patient,
    Role.Practitioner,
    Role.Doctor,
    Role.CareCoordinator,
    Role.HealthCoach,
    Role.Nutritionist,
  ])
  @Mutation(() => MessageResponse)
  cancelAppointment(@Arg("input") input: GetAppointmentInput) {
    return this.appointmentService.cancelAppointment(input)
  }

  @Authorized([Role.Practitioner, Role.Doctor, Role.Admin, Role.HealthCoach])
  @Mutation(() => EAProviderProfile)
  updateProviderProfile(
    @Arg("eaProviderId") eaProviderId: string,
    @Arg("input") input: EAProviderProfile
  ) {
    return this.appointmentService.updateProvider(eaProviderId, input)
  }

  @Authorized([Role.Practitioner, Role.Doctor, Role.Admin, Role.HealthCoach])
  @Query(() => EAProviderProfile)
  getAProvider(@Arg("eaProviderId") eaProviderId: string) {
    return this.appointmentService.getProvider(eaProviderId)
  }

  @Authorized([Role.Admin])
  @Mutation(() => String)
  createCustomer(@Arg("input") input: CreateCustomerInput) {
    return this.appointmentService.createCustomer(input)
  }

  @Authorized([Role.Admin, Role.Practitioner, Role.Doctor, Role.HealthCoach])
  @Query(() => ScheduleObject)
  getProviderSchedule(
    @Arg("eaProviderId") eaProviderId: string,
    @Arg("timezone") timezone: string
  ) {
    return this.appointmentService.getProviderSchedule(eaProviderId, timezone)
  }

  @Authorized([Role.Admin, Role.Practitioner, Role.Doctor, Role.HealthCoach])
  @Mutation(() => UpdateScheduleMessage)
  updateProviderSchedule(
    @Arg("eaProviderId") eaProviderId: string,
    @Arg("timezone") timezone: string,
    @Arg("schedule") schedule: Schedule
  ) {
    return this.appointmentService.updateProviderSchedule(
      eaProviderId,
      timezone,
      schedule
    )
  }

  @Authorized([
    Role.Patient,
    Role.Practitioner,
    Role.Doctor,
    Role.CareCoordinator,
    Role.HealthCoach,
    Role.Nutritionist,
  ])
  @Mutation(() => EAAppointment)
  createAppointment(
    @Ctx() context: Context,
    @Arg("input") input: CreateAppointmentInput
  ) {
    return this.appointmentService.createAppointment(context.user, input)
  }

  @Authorized([Role.Admin])
  @Mutation(() => MessageResponse)
  async runPostAppointmentJob() {
    await this.appointmentService.postAppointmentJob()

    return {
      message: "Post appointment job complete.",
    }
  }
}

import { Arg, Authorized, Ctx, Mutation, Query, Resolver } from "type-graphql"
import {
  AllTimeslotsInput,
  CreateAppointmentInput,
  CreateCustomerInput,
  EAAppointment,
  EAAppointmentWithCustomer,
  EAProviderProfile,
  ProviderTimeslotsInput,
  TimeslotsResponse,
  UpdateAppointmentInput
} from "../schema/appointment.schema"
import { MessageResponse, Role } from "../schema/user.schema"
import AppointmentService from "../services/appointment.service"
import Context from "../types/context"

@Resolver()
export default class AppointmentResolver {
  constructor(private appointmentService: AppointmentService) {
    this.appointmentService = new AppointmentService()
  }

  @Authorized([Role.Patient])
  @Query(() => TimeslotsResponse)
  allTimeslots(
    @Ctx() context: Context,
    @Arg("input") input: AllTimeslotsInput
  ) {
    return this.appointmentService.allTimeslots(context.user._id, input)
  }

  @Authorized([Role.Patient])
  @Query(() => TimeslotsResponse)
  providerTimeslots(@Arg("input") input: ProviderTimeslotsInput) {
    return this.appointmentService.providerTimeslots(input)
  }

  @Authorized([Role.Patient])
  @Query(() => EAAppointment)
  appointment(
    @Ctx() context: Context,
    @Arg("eaAppointmentId") eaAppointmentId: string
  ) {
    return this.appointmentService.getAppointment(
      context.user._id,
      eaAppointmentId
    )
  }

  @Authorized([Role.Patient])
  @Query(() => [EAAppointment])
  appointments(
    @Ctx() context: Context,
    @Arg("limit", { defaultValue: 3, nullable: true }) limit?: number
  ) {
    return this.appointmentService.getAppointments(context.user._id, limit)
  }

  @Authorized([Role.Practitioner, Role.Admin, Role.HealthCoach])
  @Query(() => [EAAppointmentWithCustomer])
  providerAppointments(@Arg("eaProviderId") eaProviderId: string) {
    return this.appointmentService.getProviderAppointments(eaProviderId)
  }

  @Authorized([Role.Practitioner, Role.Admin, Role.HealthCoach])
  @Mutation(() => EAProviderProfile)
  updateProviderProfile(
    @Arg("eaProviderId") eaProviderId: string,
    @Arg("input") input: EAProviderProfile
  ) {
    return this.appointmentService.updateProvider(eaProviderId, input)
  }
  @Authorized([Role.Practitioner, Role.Admin, Role.HealthCoach])
  @Query(() => EAProviderProfile)
  getAProvider(@Arg("eaProviderId") eaProviderId: string) {
    return this.appointmentService.getProvider(eaProviderId)
  }

  @Authorized([Role.Admin])
  @Mutation(() => String)
  createCustomer(@Arg("input") input: CreateCustomerInput) {
    return this.appointmentService.createCustomer(input)
  }

  @Authorized([Role.Patient])
  @Mutation(() => EAAppointment)
  createAppointment(
    @Ctx() context: Context,
    @Arg("input") input: CreateAppointmentInput
  ) {
    return this.appointmentService.createAppointment(context.user._id, input)
  }

  @Authorized([Role.Patient])
  @Mutation(() => EAAppointment)
  updateAppointment(
    @Ctx() context: Context,
    @Arg("input") input: UpdateAppointmentInput
  ) {
    return this.appointmentService.updateAppointment(context.user._id, input)
  }

  @Authorized([Role.Patient])
  @Mutation(() => MessageResponse)
  cancelAppointment(
    @Ctx() context: Context,
    @Arg("eaAppointmentId") eaAppointmentId: string
  ) {
    return this.appointmentService.cancelAppointment(
      context.user._id,
      eaAppointmentId
    )
  }
}

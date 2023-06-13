import * as Sentry from "@sentry/node"
import { ApolloError } from "apollo-server"
import axios, { AxiosInstance } from "axios"
import config from "config"
import { ProviderModel } from "../schema/provider.schema"
import Context from "../types/context"
import {
  IEAAppointment,
  IEAAppointmentResponse,
  IEACustomer,
  IEAProvider,
} from "../@types/easyAppointmentTypes"
import {
  CreateAppointmentInput,
  CreateCustomerInput,
  GetAppointmentInput,
  GetAppointmentsByDateInput,
  GetAppointmentsByMonthInput,
  GetTimeslotsInput,
  UpcomingAppointmentsInput,
  UpdateAppointmentInput,
} from "../schema/appointment.schema"
import { UserTaskModel } from "../schema/task.user.schema"
import { UserModel, MessageResponse } from "../schema/user.schema"
import Role from "../schema/enums/Role"
import { createMeetingAndToken } from "../utils/daily"
import EmailService from "./email.service"
import dayjs from "dayjs"
import tz from "dayjs/plugin/timezone"
import utc from "dayjs/plugin/utc"
import advanced from "dayjs/plugin/advancedFormat"
import CandidService from "./candid.service"

dayjs.extend(utc)
dayjs.extend(tz)
dayjs.extend(advanced)

/** Convert appointment object from EA to the format used in graphQL. */
function eaResponseToEAAppointment(
  response: IEAAppointmentResponse
): IEAAppointment {
  return {
    eaAppointmentId: String(response.id),
    start: response.start,
    end: response.end,
    location: response.location,
    timezone: response.timezone,
    notes: response.notes,
    eaProvider: {
      id: response.provider.id,
      name: response.provider.firstName + " " + response.provider.lastName,
      email: response.provider.email,
      firstName: response.provider.firstName,
      lastName: response.provider.lastName,
      type: response.provider.type,
    },
    eaService: {
      id: String(response.service.id),
      name: response.service.name,
      durationInMins: response.service.duration,
      description: response.service.description,
    },
    eaCustomer: {
      id: String(response.customer.id),
      name: `${response.customer.firstName} ${response.customer.lastName}`,
      firstName: response.customer.firstName,
      lastName: response.customer.lastName,
      email: response.customer.email,
      phone: response.customer.phone,
    },
    notifiedCustomer: response.notifiedCustomer,
    notifiedProvider: response.notifiedProvider,
    patientAttended: response.patientAttended,
    providerAttended: response.providerAttended,
    claimSubmitted: response.claimSubmitted,
    attendanceEmailSent: response.attendanceEmailSent,
  }
}

interface TimeBlock {
  start: string
  end: string
}

type Break = TimeBlock

interface DailySchedule extends TimeBlock {
  breaks: Break[]
}

interface Schedule {
  sunday: DailySchedule
  monday: DailySchedule
  tuesday: DailySchedule
  wednesday: DailySchedule
  thursday: DailySchedule
  friday: DailySchedule
  saturday: DailySchedule
}

interface Exceptions {
  date: DailySchedule
}

interface ScheduleObject {
  timezone: string
  schedule: Schedule
  exceptions: Exceptions
}

class AppointmentService extends EmailService {
  public eaUrl: string
  public axios: AxiosInstance
  private candidService: CandidService

  constructor() {
    super()
    const eaUrl = config.get("easyAppointmentsApiUrl") as string
    this.candidService = new CandidService(this)

    this.eaUrl = eaUrl
    this.axios = axios.create({
      baseURL: this.eaUrl,
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer letmein1",
      },
    })
  }

  async createCustomer(input: CreateCustomerInput) {
    const { notFound } = config.get("errors.user") as any
    const {
      userId,
      firstName,
      lastName,
      email,
      phone,
      address,
      city,
      zipCode,
      state,
      notes,
      updateUser = false,
    } = input

    try {
      if (updateUser) {
        const user = await UserModel.findById(userId).countDocuments()
        if (!user) {
          throw new ApolloError(notFound.message, notFound.code)
        }
      }

      const { data: eaCustomer } = await this.axios.get(
        `/customers?q=${encodeURIComponent(email)}`
      )
      if (eaCustomer.length) {
        if (updateUser) {
          await UserModel.findByIdAndUpdate(userId, {
            eaCustomerId: eaCustomer[0].id,
          })
        }
        return eaCustomer[0].id
      }

      const { data } = await this.axios.post<IEACustomer>("/customers", {
        firstName,
        lastName,
        email,
        phone,
        address,
        city,
        state,
        zip: zipCode,
        timezone: "UTC",
        language: "english",
        notes,
      })

      if (updateUser) {
        await UserModel.findByIdAndUpdate(userId, {
          eaCustomerId: data.id,
        })
      }

      // return easyappointments customer id
      return data.id
    } catch (error) {
      Sentry.captureException(error)
      throw new ApolloError(error.message, "ERROR")
    }
  }

  async getTimeslots(user: Context["user"], input: GetTimeslotsInput) {
    try {
      const { selectedDate, timezone, bypassNotice, appointmentId, userId } =
        input
      const { notFound, noEaCustomerId } = config.get("errors.user") as any

      let eaProviderId
      if (!bypassNotice) {
        const _user = await UserModel.findById(user._id)
        if (!_user) {
          throw new ApolloError(notFound.message, notFound.code)
        }

        if (!_user.eaCustomerId) {
          throw new ApolloError(noEaCustomerId.message, noEaCustomerId.code)
        }

        const provider = await ProviderModel.findById(_user.provider)
        if (!provider) {
          throw new ApolloError(notFound.message, notFound.code)
        }

        if (!provider.eaProviderId) {
          throw new ApolloError(noEaCustomerId.message, noEaCustomerId.code)
        }

        eaProviderId = provider.eaProviderId
      } else {
        const provider = await ProviderModel.findById(user._id)
        if (!provider) {
          throw new ApolloError(notFound.message, notFound.code)
        }

        if (!provider.eaProviderId) {
          throw new ApolloError(noEaCustomerId.message, noEaCustomerId.code)
        }

        eaProviderId = provider.eaProviderId
      }

      let eaCustomer = {
        id: "",
        name: "",
        email: "",
      }

      if (userId) {
        const _user = await UserModel.findById(userId)
        if (!_user) {
          throw new ApolloError(notFound.message, notFound.code)
        }

        if (!_user.eaCustomerId) {
          throw new ApolloError(noEaCustomerId.message, noEaCustomerId.code)
        }

        eaCustomer = {
          id: _user.eaCustomerId,
          name: _user.name,
          email: _user.email,
        }
      }

      const { data: response } = await this.axios.get("/availabilities", {
        params: {
          eaProviderId: eaProviderId,
          eaServiceId: 1,
          selectedDate,
          timezone,
          bypassNotice,
          ...(appointmentId && {
            eaAppointmentId: appointmentId,
          }),
        },
      })

      return {
        total: response.total,
        selectedDate: response.selectedDate,
        timezone,
        eaService: response.eaService,
        eaProvider: response.eaProvider,
        timeslots: response.timeslots,
        eaCustomer,
      }
    } catch (error) {
      Sentry.captureException(error)
      throw new ApolloError(error.message, "ERROR")
    }
  }

  async createAppointment(
    user: Context["user"],
    input: CreateAppointmentInput
  ) {
    try {
      const { notFound, noEaCustomerId } = config.get("errors.user") as any
      const { userId, start, end, timezone, notes, bypassNotice, userTaskId } =
        input

      const _user = await UserModel.findById(userId ? userId : user._id)
      if (!_user) {
        throw new ApolloError(notFound.message, notFound.code)
      }

      if (!_user.eaCustomerId) {
        throw new ApolloError(noEaCustomerId.message, noEaCustomerId.code)
      }

      const eaCustomerId = _user.eaCustomerId

      const provider = await ProviderModel.findById(_user.provider)
      if (!provider) {
        throw new ApolloError(notFound.message, notFound.code)
      }

      if (!provider.eaProviderId) {
        throw new ApolloError(noEaCustomerId.message, noEaCustomerId.code)
      }

      const eaProviderId = provider.eaProviderId

      const meetingData = await createMeetingAndToken(_user.id)
      const { data: response } = await this.axios.post(
        `/appointments?bypassNotice=${bypassNotice}`,
        {
          start,
          end,
          timezone,
          location: meetingData,
          customerId: eaCustomerId,
          providerId: eaProviderId,
          serviceId: 1,
          notes: notes || "",
        }
      )

      // call complete task for schedule appt
      if (userTaskId) {
        const userTask = await UserTaskModel.findById(userTaskId)
        if (!userTask) {
          throw new ApolloError(notFound.message, notFound.code)
        }

        userTask.completed = true
        await userTask.save()
      }

      await UserModel.findByIdAndUpdate(userId, {
        meetingUrl: meetingData,
      })

      if (response) {
        await this.sendAppointmentCreatedEmail({
          name: response.provider.firstName,
          email: response.provider.email,
          date: dayjs
            .tz(response.start, response.timezone)
            .format("MM/DD/YYYY"),
          start: `${dayjs
            .tz(response.start, response.timezone)
            .format("h:mm A (z)")}`,
          end: `${dayjs
            .tz(response.end, response.timezone)
            .format("h:mm A (z)")}`,
          otherName:
            response.customer.firstName + " " + response.customer.lastName,
          id: response.id,
          provider: true,
        })

        await this.sendAppointmentCreatedEmail({
          name: response.customer.firstName,
          email: response.customer.email,
          date: dayjs
            .tz(response.start, response.timezone)
            .format("MM/DD/YYYY"),
          start: `${dayjs
            .tz(response.start, response.timezone)
            .format("h:mm A (z)")}`,
          end: `${dayjs
            .tz(response.end, response.timezone)
            .format("h:mm A (z)")}`,
          otherName:
            response.provider.firstName + " " + response.provider.lastName,
          id: response.id,
          provider: false,
        })
      }

      return eaResponseToEAAppointment(response)
    } catch (error) {
      console.log(error)
      Sentry.captureException(error)
      throw new ApolloError(error.message, "ERROR")
    }
  }

  /**
   * Flags a patient or provider as having attended the appointment.
   * Also allows flags to be set for a non-attendance email having been sent,
   * and an insurance claim having been submitted.
   */
  async updateAppointmentAttended(
    /** Optional: the logged in user to calculate patient_attended and provider_attended. */
    authUser: Context["user"] | null,
    eaAppointmentId: string,
    /** Additional flags to set (overrides authUser-derived flags). */
    flags: (
      | "patient_attended"
      | "provider_attended"
      | "attendance_email_sent"
      | "claim_submitted"
    )[] = []
  ): Promise<MessageResponse> {
    const params: {
      patient_attended?: boolean
      provider_attended?: boolean
      attendance_email_sent?: boolean
      claim_submitted?: boolean
    } = {}

    // calculate patient/provider attendance from auth user
    if (authUser) {
      const isPatient = authUser.role === Role.Patient
      if (isPatient) {
        params.patient_attended = true
      } else {
        params.provider_attended = true
      }
    }

    // add flags to params
    flags.forEach((flag) => (params[flag] = true))

    try {
      await this.axios.put(`/appointments/${eaAppointmentId}/attended`, params)
      return { message: "Marked appointment attended." }
    } catch (error) {
      Sentry.captureException(error)
      console.log(error)
      throw new ApolloError(error.message, "ERROR")
    }
  }

  async updateAppointment(input: UpdateAppointmentInput) {
    try {
      const { eaAppointmentId, start, end, notes, timezone, bypassNotice } =
        input

      const { data: response } = await this.axios.put(
        `/appointments/${eaAppointmentId}?bypassNotice=${bypassNotice}`,
        {
          start,
          end,
          timezone,
          notes: notes || "",
        }
      )

      if (response) {
        await this.sendAppointmentUpdatedEmail({
          name: response.provider.firstName,
          email: response.provider.email,
          date: dayjs
            .tz(response.start, response.timezone)
            .format("MM/DD/YYYY"),
          start: `${dayjs
            .tz(response.start, response.timezone)
            .format("h:mm A (z)")}`,
          end: `${dayjs
            .tz(response.end, response.timezone)
            .format("h:mm A (z)")}`,
          otherName:
            response.customer.firstName + " " + response.customer.lastName,
          id: response.id,
          provider: true,
        })

        await this.sendAppointmentUpdatedEmail({
          name: response.customer.firstName,
          email: response.customer.email,
          date: dayjs
            .tz(response.start, response.timezone)
            .format("MM/DD/YYYY"),
          start: `${dayjs
            .tz(response.start, response.timezone)
            .format("h:mm A (z)")}`,
          end: `${dayjs
            .tz(response.end, response.timezone)
            .format("h:mm A (z)")}`,
          otherName:
            response.provider.firstName + " " + response.provider.lastName,
          id: response.id,
          provider: false,
        })
      }

      return eaResponseToEAAppointment(response)
    } catch (error) {
      console.log(error)
      Sentry.captureException(error)
      throw new ApolloError(error.message, "ERROR")
    }
  }

  async cancelAppointment(input: GetAppointmentInput) {
    try {
      const { data: getData } = await this.axios.get(
        `/appointments/${input.eaAppointmentId}?timezone=${input.timezone}`
      )
      const response = getData

      const { data } = await this.axios.delete(
        `/appointments/${input.eaAppointmentId}`
      )

      if (data) {
        await this.sendAppointmentCancelledEmail({
          name: response.provider.firstName,
          email: response.provider.email,
          date: dayjs
            .tz(response.start, response.timezone)
            .format("MM/DD/YYYY"),
          start: `${dayjs
            .tz(response.start, response.timezone)
            .format("h:mm A (z)")}`,
          end: `${dayjs
            .tz(response.end, response.timezone)
            .format("h:mm A (z)")}`,
          otherName:
            response.customer.firstName + " " + response.customer.lastName,
          provider: true,
        })

        await this.sendAppointmentCancelledEmail({
          name: response.customer.firstName,
          email: response.customer.email,
          date: dayjs
            .tz(response.start, response.timezone)
            .format("MM/DD/YYYY"),
          start: `${dayjs
            .tz(response.start, response.timezone)
            .format("h:mm A (z)")}`,
          end: `${dayjs
            .tz(response.end, response.timezone)
            .format("h:mm A (z)")}`,
          otherName:
            response.provider.firstName + " " + response.provider.lastName,
          provider: false,
        })
      }

      return {
        message: data.message,
      }
    } catch (error) {
      Sentry.captureException(error)
      throw new ApolloError(error.message, "ERROR")
    }
  }

  async getAppointment(input: GetAppointmentInput) {
    try {
      const { data } = await this.axios.get(
        `/appointments/${input.eaAppointmentId}?timezone=${input.timezone}`
      )
      const response = data

      return eaResponseToEAAppointment(response)
    } catch (error) {
      Sentry.captureException(error)
      throw new ApolloError("Could not find appointment.", "NOT_FOUND")
    }
  }

  /**
   * Returns the completed initial appointment for the given customer, or null
   * if no appointment has been completed yet.
   */
  async getInitialAppointment(
    eaCustomerId: string
  ): Promise<IEAAppointment | null> {
    try {
      const { data } = await this.axios.get<IEAAppointmentResponse>(
        "/appointments/initial",
        {
          params: { eaCustomerId, timezone: "America/New_York" },
        }
      )

      if (data) {
        return eaResponseToEAAppointment(data)
      } else {
        return null
      }
    } catch (error) {
      if (error.response?.data?.code === 404) {
        return null
      } else {
        throw error
      }
    }
  }

  async upcomingAppointments(
    user: Context["user"],
    input: UpcomingAppointmentsInput
  ): Promise<IEAAppointment[]> {
    try {
      const { notFound, noEaCustomerId } = config.get("errors.user") as any

      let eaUserId

      if (user.role === Role.Doctor || user.role === Role.Practitioner) {
        const provider = await ProviderModel.findById(user._id)
        if (!provider) {
          throw new ApolloError(notFound.message, notFound.code)
        }

        if (!provider.eaProviderId) {
          throw new ApolloError(noEaCustomerId.message, noEaCustomerId.code)
        }

        eaUserId = provider.eaProviderId
      } else {
        const _user = await UserModel.findById(user._id)
        if (!_user) {
          throw new ApolloError(notFound.message, notFound.code)
        }

        if (!_user.eaCustomerId) {
          throw new ApolloError(noEaCustomerId.message, noEaCustomerId.code)
        }

        eaUserId = _user.eaCustomerId
      }

      const { data } = await this.axios.get<IEAAppointmentResponse[]>(
        "/appointments/upcoming",
        {
          params: {
            ...(user.role !== Role.Practitioner && user.role !== Role.Doctor
              ? {
                  eaCustomerId: eaUserId,
                }
              : {
                  eaProviderId: eaUserId,
                }),
            timezone: input.timezone,
            selectedDate: input.selectedDate,
          },
        }
      )

      const apps = data
        .filter((response) => response.customer && response.service)
        .map((response) => eaResponseToEAAppointment(response))

      return apps
    } catch (error) {
      Sentry.captureException(error)
      throw new ApolloError(error.message, "ERROR")
    }
  }

  async getAppointmentsByMonth(
    user: Context["user"],
    input: GetAppointmentsByMonthInput
  ): Promise<IEAAppointment[]> {
    try {
      const { notFound, noEaCustomerId } = config.get("errors.user") as any

      let eaUserId

      if (user.role === Role.Doctor || user.role === Role.Practitioner) {
        const provider = await ProviderModel.findById(user._id).lean()
        if (!provider) {
          throw new ApolloError(notFound.message, notFound.code)
        }

        if (!provider.eaProviderId) {
          throw new ApolloError(noEaCustomerId.message, noEaCustomerId.code)
        }

        eaUserId = provider.eaProviderId
      } else {
        const _user = await UserModel.findById(user._id).lean()
        if (!_user) {
          throw new ApolloError(notFound.message, notFound.code)
        }

        if (!_user.eaCustomerId) {
          throw new ApolloError(noEaCustomerId.message, noEaCustomerId.code)
        }

        eaUserId = _user.eaCustomerId
      }

      const { data } = await this.axios.get<IEAAppointmentResponse[]>(
        "/appointments/month",
        {
          params: {
            ...(user.role !== Role.Practitioner && user.role !== Role.Doctor
              ? {
                  eaCustomerId: eaUserId,
                }
              : {
                  eaProviderId: eaUserId,
                }),
            timezone: input.timezone,
            month: input.month,
          },
        }
      )
      const apps = data
        .filter((response) => response.customer && response.service)
        .map((response) => eaResponseToEAAppointment(response))

      return apps
    } catch (error) {
      Sentry.captureException(error)
      throw new ApolloError(error.message, "ERROR")
    }
  }

  async getAppointmentsByDate(
    user: Context["user"] | null,
    input: GetAppointmentsByDateInput
  ): Promise<IEAAppointment[]> {
    try {
      const { notFound, noEaCustomerId } = config.get("errors.user") as any

      let eaUserId

      if (user) {
        if (user.role === Role.Doctor || user.role === Role.Practitioner) {
          const provider = await ProviderModel.findById(user._id).lean()
          if (!provider) {
            throw new ApolloError(notFound.message, notFound.code)
          }

          if (!provider.eaProviderId) {
            throw new ApolloError(noEaCustomerId.message, noEaCustomerId.code)
          }

          eaUserId = provider.eaProviderId
        } else {
          const _user = await UserModel.findById(user._id).lean()
          if (!_user) {
            throw new ApolloError(notFound.message, notFound.code)
          }

          if (!_user.eaCustomerId) {
            throw new ApolloError(noEaCustomerId.message, noEaCustomerId.code)
          }

          eaUserId = _user.eaCustomerId
        }
      }

      const appointmentsByDateParams: {
        eaCustomerId?: string | number
        eaProviderId?: string | number
      } = {}
      if (
        eaUserId &&
        user &&
        user.role !== Role.Practitioner &&
        user.role !== Role.Doctor
      ) {
        appointmentsByDateParams.eaCustomerId = eaUserId
      } else if (eaUserId) {
        appointmentsByDateParams.eaProviderId = eaUserId
      }

      const { data } = await this.axios.get<IEAAppointmentResponse[]>(
        "/appointments/date",
        {
          params: {
            ...appointmentsByDateParams,
            timezone: input.timezone,
            selectedDate: input.selectedDate,
          },
        }
      )

      const apps = data.map((response) => eaResponseToEAAppointment(response))

      return apps
    } catch (error) {
      Sentry.captureException(error)
      throw new ApolloError(error.message, "ERROR")
    }
  }

  async updateProvider(
    eaProviderId: string,
    providerData: IEAProvider
  ): Promise<IEAProvider> {
    try {
      const { data } = await this.axios.put<IEAProvider>(
        `/providers/${eaProviderId}`,
        providerData
      )
      return data
    } catch (err) {
      Sentry.captureException(err)
    }
  }

  async getProvider(eaProviderId: string): Promise<IEAProvider> {
    try {
      const { data } = await this.axios.get<IEAProvider>(
        `/providers/${eaProviderId}`
      )
      return data
    } catch (err) {
      Sentry.captureException(err)
    }
  }

  async getProviderSchedule(
    eaProviderId: string,
    timezone: string
  ): Promise<ScheduleObject> {
    try {
      // timezone example: America/New_York
      const schedule = await this.axios.get<ScheduleObject>(
        `/providers/schedule?eaProviderId=${eaProviderId}&timezone=${timezone}`
      )
      return schedule.data
    } catch (err) {
      console.log(err)
      Sentry.captureException(err)
    }
  }

  /**
   * Handles actions that need to occur after an appointment has ended:
   * patient/provider skipped emails, and claim submissions. The actions
   * are marked as completed on the EA appointment to prevent duplication.
   */
  async handleAppointmentEnded(appointment: IEAAppointment) {
    const user = await UserModel.findOne({
      eaCustomerId: appointment.eaCustomer.id,
    })

    console.log(
      `Processing ended appointment [${appointment.eaAppointmentId}]: ${appointment.eaCustomer?.name} [${appointment.eaCustomer?.id} - ${user._id} - ${user.email}], provider ${appointment.eaProvider?.name} [${appointment.eaProvider?.id}], ${appointment.start} to ${appointment.end} ${appointment.timezone}.`
    )

    // Reasons to process an appointment:
    const patientNoShow =
      !appointment.attendanceEmailSent && !appointment.patientAttended
    const providerNoShow =
      !appointment.attendanceEmailSent && !appointment.providerAttended
    const claimNotSubmitted =
      !appointment.claimSubmitted &&
      appointment.patientAttended &&
      appointment.providerAttended

    if (!patientNoShow && !providerNoShow && !claimNotSubmitted) {
      console.log("- No action taken.")
      return
    }

    // patient no show.
    if (patientNoShow) {
      const logMessage = `- Sending patient appointment (id: ${appointment.eaAppointmentId}) no-show email: ${appointment.eaCustomer?.firstName} ${appointment.eaCustomer?.lastName}`
      console.log(logMessage)
      Sentry.captureMessage(logMessage)
      await this.sendAppointmentPatientSkippedEmail({
        eaAppointmentId: `${appointment.eaAppointmentId}`,
        name: appointment.eaCustomer?.firstName ?? "",
        email: appointment.eaCustomer?.email ?? null,
        providerName: appointment.eaProvider?.name ?? null,
        date: dayjs
          .tz(appointment.start, appointment.timezone)
          .format("MM/DD/YYYY"),
        time: dayjs
          .tz(appointment.start, appointment.timezone)
          .format("h:mm A (z)"),
      })
      await this.updateAppointmentAttended(null, appointment.eaAppointmentId, [
        "attendance_email_sent",
      ])
    }

    // provider no show.
    if (providerNoShow) {
      const logMessage = `- Sending provider appointment (id: ${appointment.eaAppointmentId}) no-show email: ${appointment.eaProvider.firstName} ${appointment.eaProvider.lastName}`
      console.log(logMessage)
      Sentry.captureMessage(logMessage)

      await this.sendAppointmentProviderSkippedEmail({
        eaAppointmentId: `${appointment.eaAppointmentId}`,
        name: appointment.eaProvider.firstName ?? "",
        email: appointment.eaProvider.email ?? null,
        patientName: appointment.eaProvider.name ?? null,
        date: dayjs
          .tz(appointment.start, appointment.timezone)
          .format("MM/DD/YYYY"),
        time: dayjs
          .tz(appointment.start, appointment.timezone)
          .format("h:mm A (z)"),
      })
      await this.updateAppointmentAttended(null, appointment.eaAppointmentId, [
        "attendance_email_sent",
      ])
    }

    // appointment ended, but no claim submitted
    if (claimNotSubmitted) {
      console.log("- Submitting insurance claim for attended appointment")
      try {
        if (user.insurance) {
          await this.candidService.createCodedEncounterForAppointment(
            appointment
          )
        } else {
          const noBillingMessage = `Did not bill user ${user._id}, no insurance data.`
          Sentry.captureMessage(noBillingMessage)
          console.log(noBillingMessage)
        }
        await this.updateAppointmentAttended(
          null,
          appointment.eaAppointmentId,
          ["claim_submitted"]
        )
      } catch (error) {
        Sentry.captureException(error)
        console.log(
          `Error creating a coded encounter for appointment ${appointment.eaAppointmentId}.`,
          error
        )
      }
    }
  }

  /**
   * Work that runs every 30 minutes to perform actions after each appointment ends.
   * Sends no-show emails to patients and providers who did not attend (attendance is marked
   * by the updateAppointmentAttended mutation), and submits insurance claims for
   * appointments that were attended by both patient and provider.
   */
  async postAppointmentJob(): Promise<void> {
    const timezone = "America/New_York"
    const now = dayjs.tz(new Date(), timezone)

    // queries to EasyAppointments for yesterday, today and tomorrow to account for possible
    // time zone discrepancies (EA appointment dates are in the time zone of the provider, not UTC).
    const appointmentQueries = [now.subtract(1, "day"), now, now.add(1, "day")]
      .map((day) => day.format("MM/DD/YYYY"))
      .map(
        (selectedDate) => () =>
          this.getAppointmentsByDate(null, { selectedDate, timezone })
      )

    const appointments = []
    for (const appointmentQuery of appointmentQueries) {
      const appointmentSet = await appointmentQuery()
      appointments.push(...appointmentSet)
    }

    const pastAppointments = appointments.filter((appointment) => {
      const appointmentEndTime = dayjs.tz(appointment.end, appointment.timezone)
      return appointmentEndTime.isBefore(now)
    })

    console.log(
      `Queried ${appointments.length} appointments, ${pastAppointments.length} have ended:`
    )

    // TODO: use batchAsync from sendbird PR to scale
    await Promise.all(
      pastAppointments.map(
        async (appointment) => await this.handleAppointmentEnded(appointment)
      )
    )
  }

  async updateProviderSchedule(
    eaProviderId: string,
    timezone: string,
    schedule: Schedule
  ) {
    try {
      const { data } = await this.axios.put(
        `/providers/schedule?eaProviderId=${eaProviderId}&timezone=${timezone}`,
        {
          schedule: schedule,
          exceptions: [],
        }
      )
      return data
    } catch (err) {
      Sentry.captureException(err)
    }
  }
}

export default AppointmentService

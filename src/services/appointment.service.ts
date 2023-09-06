import * as Sentry from "@sentry/node"
import { ApolloError } from "apollo-server"
import axios, { AxiosInstance } from "axios"
import { LeanDocument } from "mongoose"
import config from "config"
import Context from "../types/context"
import { createMeetingAndToken } from "../utils/daily"
import dayjs from "../utils/dayjs"
import { captureException, captureEvent } from "../utils/sentry"
import batchAsync from "../utils/batchAsync"
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
import { Provider, ProviderModel } from "../schema/provider.schema"
import { UserTaskModel } from "../schema/task.user.schema"
import { UserModel, MessageResponse, User } from "../schema/user.schema"
import Role from "../schema/enums/Role"
import CandidService from "./candid.service"
import EmailService from "./email.service"

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
    this.candidService = new CandidService()

    this.eaUrl = eaUrl
    this.axios = axios.create({
      baseURL: this.eaUrl,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.EASY_APPOINTMENTS_API_KEY}`,
      },
    })
  }

  /** Returns the customer if it exists, otherwise returns null. */
  async getCustomer(eaCustomerId: string) {
    try {
      const { data: customer } = await this.axios.get<IEACustomer>(
        `/customers/${eaCustomerId}`
      )
      return customer
    } catch (error) {
      return null
    }
  }

  async getCustomerByEmail(email: string) {
    email = email.toLowerCase()

    try {
      const { data: eaCustomers } = await this.axios.get(
        `/customers?q=${encodeURIComponent(email)}`
      )

      return eaCustomers[0] ?? null
    } catch (error) {
      captureException(error, "AppointmentService.getCustomerByEmail")
    }
  }

  /** Updates the given customer. */
  async updateCustomer(eaCustomerId: string, customerData: IEACustomer) {
    try {
      const { data: customer } = await this.axios.put<IEACustomer>(
        `/customers/${eaCustomerId}`,
        customerData
      )

      return customer
    } catch (error) {
      captureException(error, "ApointmentService.updateCustomer", {
        eaCustomerId,
        customerData,
      })
      throw new ApolloError("Error updating customer.")
    }
  }

  /**
   * Creates a customer, returning the customer ID.
   * If a customer with the given email already exists,
   * updates the user with the correct eaCustomerId.
   */
  async createCustomer(input: CreateCustomerInput): Promise<string> {
    input.email = input.email.toLowerCase()

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

      const eaCustomer = await this.getCustomerByEmail(email)
      if (eaCustomer) {
        if (updateUser) {
          await UserModel.findByIdAndUpdate(userId, {
            eaCustomerId: eaCustomer[0].id,
          })
        }
        return eaCustomer[0]
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

      return String(data.id)
    } catch (error) {
      Sentry.captureException(error)
      throw new ApolloError(error.message, "ERROR")
    }
  }

  async getTimeslots(user: Context["user"], input: GetTimeslotsInput) {
    try {
      const {
        selectedDate,
        timezone,
        bypassNotice,
        appointmentId,
        userId,
        healthCoach,
      } = input
      const { notFound, noEaCustomerId } = config.get("errors.user") as any
      const { notFound: providerNotFound } = config.get(
        "errors.provider"
      ) as any

      let eaProviderId

      const _user = await UserModel.findById(userId ? userId : user._id)
      if (!_user) {
        throw new ApolloError(notFound.message, notFound.code)
      }

      if (!_user.eaCustomerId) {
        throw new ApolloError(noEaCustomerId.message, noEaCustomerId.code)
      }

      if (healthCoach) {
        eaProviderId = 118
      } else {
        const provider = await ProviderModel.findById(_user.provider)
        if (!provider) {
          throw new ApolloError(providerNotFound.message, providerNotFound.code)
        }

        if (!provider.eaProviderId) {
          throw new ApolloError(noEaCustomerId.message, noEaCustomerId.code)
        }

        eaProviderId = provider.eaProviderId
      }

      const eaCustomer = {
        id: _user.eaCustomerId,
        name: _user.name,
        email: _user.email,
      }

      const { data: response } = await this.axios.get("/availabilities", {
        params: {
          eaProviderId,
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

  async createAppointment(user: User, input: CreateAppointmentInput) {
    const { notFound, noEaCustomerId } = config.get("errors.user") as any
    const {
      userId,
      start,
      end,
      timezone,
      notes,
      bypassNotice,
      userTaskId,
      healthCoach,
    } = input

    const _user = await UserModel.findById(userId ? userId : user._id)
    if (!_user) {
      throw new ApolloError(notFound.message, notFound.code)
    }

    if (!_user.eaCustomerId) {
      throw new ApolloError(noEaCustomerId.message, noEaCustomerId.code)
    }

    const eaCustomerId = _user.eaCustomerId
    let eaProviderId
    if (healthCoach) {
      eaProviderId = 118
    } else {
      const provider = await ProviderModel.findById(_user.provider)
      if (!provider) {
        throw new ApolloError(notFound.message, notFound.code)
      }

      if (!provider.eaProviderId) {
        throw new ApolloError(noEaCustomerId.message, noEaCustomerId.code)
      }

      eaProviderId = provider.eaProviderId
    }

    const meetingData = await createMeetingAndToken(_user.id)

    let response: IEAAppointmentResponse
    try {
      const createAppointmentParams = {
        start,
        end,
        timezone,
        location: meetingData,
        customerId: eaCustomerId,
        providerId: eaProviderId,
        serviceId: 1,
        notes: notes || "",
      }
      captureEvent(
        "info",
        "AppointmentService.createAppointment: request object",
        createAppointmentParams
      )

      const { data } = await this.axios.post<IEAAppointmentResponse>(
        `/appointments?bypassNotice=${bypassNotice}`,
        createAppointmentParams
      )
      response = data

      if ((response as any).code === 400) {
        throw new ApolloError(
          (response as any).message ?? "Error creating appointment.",
          "APPOINTMENT_EXISTS"
        )
      }
    } catch (error) {
      const errorData = error.response?.data ?? error
      captureException(errorData, "AppointmentService.createAppointment")
      throw new ApolloError(error.message, "ERROR")
    }

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
        date: dayjs.tz(response.start, response.timezone).format("MM/DD/YYYY"),
        start: `${dayjs
          .tz(response.start, response.timezone)
          .format("h:mm A (z)")}`,
        end: `${dayjs
          .tz(response.end, response.timezone)
          .format("h:mm A (z)")}`,
        otherName:
          response.customer.firstName + " " + response.customer.lastName,
        id: String(response.id),
        provider: true,
      })

      await this.sendAppointmentCreatedEmail({
        name: response.customer.firstName,
        email: response.customer.email,
        date: dayjs.tz(response.start, response.timezone).format("MM/DD/YYYY"),
        start: `${dayjs
          .tz(response.start, response.timezone)
          .format("h:mm A (z)")}`,
        end: `${dayjs
          .tz(response.end, response.timezone)
          .format("h:mm A (z)")}`,
        otherName:
          response.provider.firstName + " " + response.provider.lastName,
        id: String(response.id),
        provider: false,
      })
    }

    return eaResponseToEAAppointment(response)
  }

  /**
   * Flags a patient or provider as having attended the appointment.
   * Also allows flags to be set for a non-attendance email having been sent,
   * and an insurance claim having been submitted.
   */
  async updateAppointmentAttended(
    /** Optional: the logged in user to calculate patient_attended and provider_attended. */
    authUser: User | null,
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
      captureException(error, "AppointmentService.updateAppointmentAttended", {
        flags,
        eaAppointmentId,
        user: authUser._id.toString(),
      })
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
            ...(user.role !== Role.Practitioner &&
            user.role !== Role.Doctor &&
            user.role !== Role.HealthCoach
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
    user: User,
    input: GetAppointmentsByMonthInput
  ): Promise<IEAAppointment[]> {
    try {
      const { notFound, noEaCustomerId } = config.get("errors.user") as any

      let eaUserId: number

      if (user.role === Role.Doctor || user.role === Role.Practitioner) {
        const provider: LeanDocument<Provider> = await ProviderModel.findById(
          user._id
        )
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

        eaUserId = Number(_user.eaCustomerId)
      }

      const { data } = await this.axios.get<IEAAppointmentResponse[]>(
        "/appointments/month",
        {
          params: {
            ...(user.role !== Role.Practitioner &&
            user.role !== Role.Doctor &&
            user.role !== Role.HealthCoach
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

      if ((data as any).code >= 400) {
        throw new ApolloError((data as any).message, "APPOINTMENTS_ERROR")
      }

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
      }

      const appointmentsByDateParams: {
        eaCustomerId?: string | number
        eaProviderId?: string | number
      } = {}
      if (
        eaUserId &&
        user &&
        user.role !== Role.Practitioner &&
        user.role !== Role.Doctor &&
        user.role !== Role.HealthCoach
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

  getStateId(state: string): number | null {
    const stateIndices = [
      null,
      "AL",
      "AK",
      "AZ",
      "AR",
      "CA",
      "CO",
      "CT",
      "DE",
      "FL",
      "GA",
      "HI",
      "ID",
      "IL",
      "IN",
      "IA",
      "KS",
      "KY",
      "LA",
      "ME",
      "MD",
      "MA",
      "MI",
      "MN",
      "MS",
      "MO",
      "MT",
      "NE",
      "NV",
      "NH",
      "NJ",
      "NM",
      "NY",
      "NC",
      "ND",
      "OH",
      "OK",
      "OR",
      "PA",
      "RI",
      "SC",
      "SD",
      "TN",
      "TX",
      "UT",
      "VT",
      "VA",
      "WA",
      "WV",
      "WI",
      "WY",
      "DC",
    ]
    const index = stateIndices.indexOf(state)
    return index === -1 ? null : index
  }

  async createProvider(providerData: IEAProvider): Promise<IEAProvider> {
    try {
      const { data } = await this.axios.post<IEAProvider>(
        "/providers",
        providerData
      )

      return data
    } catch (error) {
      captureException(error, "AppointmentService.createProvider", {
        providerData,
      })
      throw new ApolloError("Error creating provider.", "ERROR")
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
    } catch (error) {
      captureException(error, "AppointmentService.updateProvider", {
        eaProviderId,
        providerData,
      })
      return null
    }
  }

  async getProviderByEmail(email: string): Promise<IEAProvider> {
    email = email.toLowerCase()

    const { data: eaProviders } = await this.axios.get<IEAProvider[]>(
      `/providers?q=${encodeURIComponent(email)}`
    )

    return eaProviders[0] ?? null
  }

  async getProvider(eaProviderId: string): Promise<IEAProvider> {
    try {
      const { data } = await this.axios.get<IEAProvider>(
        `/providers/${eaProviderId}`
      )
      return data
    } catch (err) {
      return null
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

    const getAppointment = async () => {
      try {
        return await this.getAppointment({
          eaAppointmentId: appointment.eaAppointmentId,
          timezone: appointment.timezone,
        })
      } catch (error) {
        return error.message
      }
    }

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
      console.log(
        `AppointmentService.handleAppointmentEnded - No action taken ${appointment.eaAppointmentId}.`
      )
      return
    }

    captureEvent("info", "AppointmentService.handleAppointmentEnded", {
      patientNoShow,
      providerNoShow,
      claimNotSubmitted,
      appointment,
    })

    // patient no show.
    if (patientNoShow) {
      const params = {
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
      }

      const emailResult = await this.sendAppointmentPatientSkippedEmail(params)
      await this.updateAppointmentAttended(null, appointment.eaAppointmentId, [
        "attendance_email_sent",
      ])

      captureEvent(
        "info",
        "AppointmentService.handleAppointmentEnded no-show email",
        { params, emailResult, updatedAppointment: getAppointment() }
      )
    }

    // provider no show.
    if (providerNoShow) {
      const params = {
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
      }
      const emailResult = await this.sendAppointmentProviderSkippedEmail(params)
      await this.updateAppointmentAttended(null, appointment.eaAppointmentId, [
        "attendance_email_sent",
      ])

      captureEvent(
        "info",
        "AppointmentService.handleAppointmentEnded provider no-show email attendance_email_sent",
        { params, emailResult, updatedAppointment: getAppointment() }
      )
    }

    // appointment ended, but no claim submitted
    if (claimNotSubmitted) {
      try {
        if (user.insurance) {
          const initialAppointment = await this.getInitialAppointment(
            appointment.eaCustomer.id
          )

          const claimResult =
            await this.candidService.createCodedEncounterForAppointment(
              appointment,
              initialAppointment
            )

          await this.updateAppointmentAttended(
            null,
            appointment.eaAppointmentId,
            ["claim_submitted"]
          )

          captureEvent(
            "info",
            "AppointmentService.handleAppointmentEnded - claim submitted",
            {
              claimResult,
              initialAppointment,
              appointment,
              updatedAppointment: getAppointment(),
            }
          )
        } else {
          captureEvent(
            "info",
            "AppointmentService.handleAppointmentEnded - did not bill user, no insurance data.",
            { appointment, updatedAppointment: getAppointment() }
          )
        }
      } catch (error) {
        captureException(
          error,
          "AppointmentService.handleAppointmentEnded error submitting claim"
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

    const providerIds = Object.keys(
      appointments.reduce(
        (memo, { eaProvider }) => ({ ...memo, [eaProvider.id]: true }),
        {} as Record<string, boolean>
      )
    )

    const providers = (
      await ProviderModel.find({ eaProviderId: { $in: providerIds } })
    ).reduce(
      (map, provider) => ({ ...map, [provider.eaProviderId]: provider }),
      {} as Record<string, Provider>
    )

    const pastAppointments = appointments.filter((appointment) => {
      const appointmentEndTime = dayjs.tz(appointment.end, appointment.timezone)
      const provider = providers[appointment.eaProvider.id]
      return (
        provider?.type !== Role.HealthCoach && appointmentEndTime.isBefore(now)
      )
    })

    console.log(
      `Queried ${appointments.length} appointments, ${pastAppointments.length} have ended:`
    )

    // TODO: use batchAsync from sendbird PR to scale
    await batchAsync(
      pastAppointments.map(
        (appointment) => async () =>
          await this.handleAppointmentEnded(appointment)
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

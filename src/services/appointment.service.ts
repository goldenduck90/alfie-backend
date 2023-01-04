import * as Sentry from "@sentry/node"
import { ApolloError } from "apollo-server"
import axios, { AxiosInstance } from "axios"
import config from "config"
import { addMinutes, format } from "date-fns"
import { zonedTimeToUtc } from "date-fns-tz"
import { IEAProvider } from "../@types/easyAppointmentTypes"
import {
  AllTimeslotsInput,
  CreateAppointmentInput,
  CreateCustomerInput,
  EAProvider,
  ProviderTimeslotsInput,
  UpdateAppointmentInput
} from "../schema/appointment.schema"
import { ProviderModel } from "../schema/provider.schema"
import { UserTaskModel } from "../schema/task.user.schema"
import { Role, UserModel } from "../schema/user.schema"
import { createMeetingAndToken } from "../utils/daily"
class AppointmentService {
  public baseUrl: string
  public axios: AxiosInstance

  constructor() {
    this.baseUrl = "https://ea.joinalfie.com/index.php/api/v1"
    this.axios = axios.create({
      baseURL: this.baseUrl,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.EASY_APPOINTMENTS_API_KEY}`,
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

      const { data } = await this.axios.post("/customers", {
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

  async allTimeslots(userId: string, input: AllTimeslotsInput) {
    const { notFound } = config.get("errors.user") as any
    const user = await UserModel.findById(userId).lean()
    if (!user) {
      throw new ApolloError(notFound.message, notFound.code)
    }

    const { state } = user.address
    if (!state) {
      throw new ApolloError(
        "You do not have a state assigned to their account. Please contact customer support.",
        "NO_STATE_ASSIGNED_TO_USER"
      )
    }

    const { eaServiceId, providerType, selectedDate } = input

    const { data } = await this.axios.get("/availabilities/all", {
      params: {
        serviceId: eaServiceId,
        providerType,
        stateCode: state,
        selectedDate: format(selectedDate, "yyyy-MM-dd"),
      },
    })

    const response = data

    return {
      ...response,
      selectedDateInUtc: new Date(response.selectedDateInUtc),
      total: response.total,
      eaService: response.eaService,
      timeslots: response.timeslots.map(
        (timeslot: { timeInUtc: string, eaProvider: EAProvider }) => {
          const { timeInUtc, eaProvider } = timeslot
          const hours = Number(timeInUtc.split(":")[0])
          const minutes = Number(timeInUtc.split(":")[1])

          const startTimeInUtc = zonedTimeToUtc(
            new Date(
              `${format(selectedDate, "yyyy-MM-dd")} ${hours}:${minutes}:00`
            ),
            eaProvider.timezone
          )

          const endTimeInUtc = addMinutes(
            startTimeInUtc,
            response.eaService.durationInMins
          )

          return {
            startTimeInUtc,
            endTimeInUtc,
            eaProvider,
          }
        }
      ),
    }
  }

  async providerTimeslots(input: ProviderTimeslotsInput) {
    const { eaProviderId, eaServiceId, selectedDate } = input

    const { data: response } = await this.axios.get("/availabilities", {
      params: {
        eaProviderId: eaProviderId,
        eaServiceId: eaServiceId,
        selectedDate: format(selectedDate, "yyyy-MM-dd"),
      },
    })

    return {
      ...response,
      selectedDateInUtc: new Date(response.selectedDateInUtc),
      total: response.total,
      eaService: response.eaService,
      timeslots: response.timeslots.map((timeInUtc: string) => {
        const hours = Number(timeInUtc.split(":")[0])
        const minutes = Number(timeInUtc.split(":")[1])
        const startTimeInUtc = zonedTimeToUtc(
          new Date(
            `${format(selectedDate, "yyyy-MM-dd")} ${hours}:${minutes}:00`
          ),
          response.eaProvider.timezone
        )

        const endTimeInUtc = addMinutes(
          startTimeInUtc,
          response.eaService.durationInMins
        )

        return {
          startTimeInUtc,
          endTimeInUtc,
          eaProvider: response.eaProvider,
        }
      }),
    }
  }

  async createAppointment(userId: string, input: CreateAppointmentInput) {
    try {
      const { notFound, noEaCustomerId } = config.get("errors.user") as any
      const user = await UserModel.findById(userId).populate("provider")
      const userTask = await UserTaskModel.findById(input.userTaskId)
      if (!user) {
        throw new ApolloError(notFound.message, notFound.code)
      }

      const provider = user.provider as any

      if (!user.eaCustomerId) {
        throw new ApolloError(noEaCustomerId.message, noEaCustomerId.code)
      }
      const {
        providerType,
        eaServiceId,
        eaProviderId,
        startTimeInUtc,
        endTimeInUtc,
        notes,
      } = input
      const meetingData = await createMeetingAndToken(userId)
      const { data: response } = await this.axios.post("/appointments", {
        start: format(startTimeInUtc, "yyyy-MM-dd HH:mm:ss"),
        end: format(endTimeInUtc, "yyyy-MM-dd HH:mm:ss"),
        location: meetingData,
        customerId: user.eaCustomerId,
        providerId: eaProviderId,
        serviceId: eaServiceId,
        notes: notes || "",
      })
      // call complete task for schedule appt
      userTask.completed = true
      await userTask.save()
      await UserModel.findByIdAndUpdate(userId, {
        meetingUrl: meetingData,
      })
      if (
        providerType === Role.Practitioner &&
        provider.eaProviderId !== eaProviderId
      ) {
        const newProvider = await ProviderModel.findOne({ eaProviderId })
        if (!newProvider) {
          throw new ApolloError(
            `Provider with eaProviderId ${eaProviderId} not found.`,
            "NOT_FOUND"
          )
        }

        await UserModel.findByIdAndUpdate(userId, {
          provider: newProvider._id,
        })
      } else if (
        providerType === Role.HealthCoach &&
        user.eaHealthCoachId !== eaProviderId
      ) {
        await UserModel.findByIdAndUpdate(userId, {
          eaHealthCoachId: eaProviderId,
        })
      }

      return {
        eaAppointmentId: response.id,
        startTimeInUtc: new Date(response.start),
        endTimeInUtc: new Date(response.end),
        location: response.location,
        notes: response.notes,
        eaProvider: response.provider,
        eaService: response.service,
      }
    } catch (error) {
      Sentry.captureException(error)
      throw new ApolloError(error.message, "ERROR")
    }
  }

  async updateAppointment(userId: string, input: UpdateAppointmentInput) {
    const { notFound, noEaCustomerId } = config.get("errors.user") as any
    const user = await UserModel.findById(userId).populate("provider")
    if (!user) {
      throw new ApolloError(notFound.message, notFound.code)
    }

    if (!user.eaCustomerId) {
      throw new ApolloError(noEaCustomerId.message, noEaCustomerId.code)
    }

    const provider = user.provider as any

    const {
      eaAppointmentId,
      startTimeInUtc,
      endTimeInUtc,
      notes,
      eaProviderId,
      providerType,
      eaServiceId,
    } = input
    const meetingData = await createMeetingAndToken(userId)
    const { data } = await this.axios.put(`/appointments/${eaAppointmentId}`, {
      start: format(startTimeInUtc, "yyyy-MM-dd HH:mm:ss"),
      end: format(endTimeInUtc, "yyyy-MM-dd HH:mm:ss"),
      location: meetingData,
      customerId: user.eaCustomerId,
      providerId: eaProviderId,
      serviceId: eaServiceId,
      notes: notes || "",
    })
    await UserModel.findByIdAndUpdate(userId, {
      meetingUrl: meetingData,
    })
    if (
      providerType === Role.Practitioner &&
      provider.eaProviderId !== eaProviderId
    ) {
      const newProvider = await ProviderModel.findOne({ eaProviderId })
      if (!newProvider) {
        throw new ApolloError(
          `Provider with eaProviderId ${eaProviderId} not found.`,
          "NOT_FOUND"
        )
      }

      await UserModel.findByIdAndUpdate(userId, {
        provider: newProvider._id,
      })
    } else if (
      providerType === Role.HealthCoach &&
      user.eaHealthCoachId !== eaProviderId
    ) {
      await UserModel.findByIdAndUpdate(userId, {
        eaHealthCoachId: eaProviderId,
      })
    }

    return {
      eaAppointmentId: data.id,
      startTimeInUtc: new Date(data.start),
      endTimeInUtc: new Date(data.end),
      location: data.location,
      notes: data.notes,
      eaProviderId: data.providerId,
      providerType,
    }
  }

  async cancelAppointment(userId: string, eaAppointmentId: string) {
    const { notFound, noEaCustomerId } = config.get("errors.user") as any
    const user = await UserModel.findById(userId).lean()
    if (!user) {
      throw new ApolloError(notFound.message, notFound.code)
    }

    if (!user.eaCustomerId) {
      throw new ApolloError(noEaCustomerId.message, noEaCustomerId.code)
    }

    const { data } = await this.axios.delete(`/appointments/${eaAppointmentId}`)

    return {
      message: data.message,
    }
  }

  async getAppointment(userId: string, eaAppointmentId: string) {
    const { notFound, noEaCustomerId } = config.get("errors.user") as any
    const user = await UserModel.findById(userId).lean()
    if (!user) {
      throw new ApolloError(notFound.message, notFound.code)
    }

    if (!user.eaCustomerId) {
      throw new ApolloError(noEaCustomerId.message, noEaCustomerId.code)
    }
    const { data } = await this.axios.get(`/appointments/${eaAppointmentId}`)
    return {
      eaAppointmentId: data.id,
      startTimeInUtc: new Date(data.start),
      endTimeInUtc: new Date(data.end),
      location: data.location,
      notes: data.notes,
      eaProvider: {
        id: data.provider.id,
        name: data.provider.firstName + " " + data.provider.lastName,
        email: data.provider.email,
        type: data.provider.type,
        numberOfPatients: data.provider.numberOfPatients,
      },
      eaService: {
        id: data.service.id,
        name: data.service.name,
        durationInMins: data.service.duration,
        description: data.service.description,
      },
    }
  }

  async getAppointments(userId: string, limit: number) {
    const { notFound, noEaCustomerId } = config.get("errors.user") as any
    const user = await UserModel.findById(userId).lean()
    if (!user) {
      throw new ApolloError(notFound.message, notFound.code)
    }

    if (!user.eaCustomerId) {
      throw new ApolloError(noEaCustomerId.message, noEaCustomerId.code)
    }
    const { data } = await this.axios.get("/appointments", {
      params: {
        with: `id_users_customer=${Number(user.eaCustomerId)}`,
        length: 9999,
      },
    })
    // console.log(data, "data")
    // filter appointments to only include those that are scheduled for the user with the specified ID
    // and are new (start time is later than the current time) and not expired by 24 hours
    const userSpecificAppointments: any = data.filter(
      (appointment: any) =>
        new Date(appointment.start).getTime() >
        new Date().getTime() - 24 * 60 * 60 * 1000 &&
        appointment.customer.id === Number(user.eaCustomerId)
    )
    console.log(user.eaCustomerId, "user.eaCustomerId")
    console.log(userSpecificAppointments, "userSpecificAppointments")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const apps = userSpecificAppointments.map((app: any) => ({
      eaAppointmentId: app.id,
      startTimeInUtc: new Date(app.start),
      endTimeInUtc: new Date(app.end),
      location: app.location,
      notes: app.notes,
      eaProvider: {
        id: app.provider.id,
        name: app.provider.firstName + " " + app.provider.lastName,
        email: app.provider.email,
        type: app.provider.type,
        numberOfPatients: app.provider.numberOfPatients,
      },
      eaService: {
        id: app.service.id,
        name: app.service.name,
        durationInMins: app.service.duration,
        description: app.service.description,
      },
    }))

    return apps
  }

  async getProviderAppointments(eaProviderId: string) {
    try {
      const { data } = await this.axios.get(`/appointments/all/${eaProviderId}`)
      console.log(data, "data")
      const apps = data.map((app: any) => ({
        eaAppointmentId: app.id,
        startTimeInUtc: new Date(app.start),
        endTimeInUtc: new Date(app.end),
        location: app.location,
        notes: app.notes,
        eaProvider: {
          id: app.provider.id,
          name: app.provider.firstName + " " + app.provider.lastName,
          email: app.provider.email,
          type: app.provider.type,
          numberOfPatients: app.provider.numberOfPatients,
        },
        eaService: {
          id: app.service.id,
          name: app.service.name,
          durationInMins: app.service.duration,
          description: app.service.description,
        },
        eaCustomer: {
          id: app.customer.id,
          name: app.customer.firstName + " " + app.customer.lastName,
          email: app.customer.email,
        },
      }))
      return apps
    } catch (err) {
      console.log(err, "err")
      Sentry.captureException(err)
    }
  }
  async updateProvider(eaProviderId: string, providerData: IEAProvider) {
    try {
      console.log(providerData.settings.workingPlan, "providerData")
      const { data } = await this.axios.put(
        `/providers/${eaProviderId}`,
        providerData
      )
      return data
    } catch (err) {
      Sentry.captureException(err)
    }
  }
  async getProvider(eaProviderId: string) {
    try {
      const { data } = await this.axios.get(`/providers/${eaProviderId}`)
      return data
    } catch (err) {
      Sentry.captureException(err)
    }
  }
}

export default AppointmentService

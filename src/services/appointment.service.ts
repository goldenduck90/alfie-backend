import * as Sentry from "@sentry/node"
import { ApolloError } from "apollo-server"
import axios, { AxiosInstance } from "axios"
import config from "config"
import { ProviderModel } from "../schema/provider.schema"
import Context from "../types/context"
import { IEAProvider } from "../@types/easyAppointmentTypes"
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
import { Role, UserModel } from "../schema/user.schema"
import { createMeetingAndToken } from "../utils/daily"
class AppointmentService {
  public baseUrl: string
  public axios: AxiosInstance

  constructor() {
    const eaUrl = config.get("easyAppointmentsApiUrl") as string

    this.baseUrl = eaUrl
    this.axios = axios.create({
      baseURL: this.baseUrl,
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

  async getTimeslots(user: Context["user"], input: GetTimeslotsInput) {
    try {
      const { selectedDate, timezone, bypassNotice, appointmentId, userId } =
        input
      const { notFound, noEaCustomerId } = config.get("errors.user") as any

      let eaProviderId
      if (!bypassNotice) {
        const _user = await UserModel.findById(user._id).lean()
        if (!_user) {
          throw new ApolloError(notFound.message, notFound.code)
        }

        if (!_user.eaCustomerId) {
          throw new ApolloError(noEaCustomerId.message, noEaCustomerId.code)
        }

        const provider = await ProviderModel.findById(_user.provider).lean()
        if (!provider) {
          throw new ApolloError(notFound.message, notFound.code)
        }

        if (!provider.eaProviderId) {
          throw new ApolloError(noEaCustomerId.message, noEaCustomerId.code)
        }

        eaProviderId = provider.eaProviderId
      } else {
        const provider = await ProviderModel.findById(user._id).lean()
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
        const _user = await UserModel.findById(userId).lean()
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

      const _user = await UserModel.findById(userId ? userId : user._id).lean()
      if (!_user) {
        throw new ApolloError(notFound.message, notFound.code)
      }

      if (!_user.eaCustomerId) {
        throw new ApolloError(noEaCustomerId.message, noEaCustomerId.code)
      }

      const eaCustomerId = _user.eaCustomerId

      const provider = await ProviderModel.findById(_user.provider).lean()
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

      return {
        eaAppointmentId: response.id,
        start: response.start,
        end: response.end,
        location: response.location,
        timezone: response.timezone,
        notes: response.notes,
        eaProvider: {
          id: response.provider.id,
          name: response.provider.firstName + " " + response.provider.lastName,
          email: response.provider.email,
          type: response.provider.type,
        },
        eaService: {
          id: response.service.id,
          name: response.service.name,
          durationInMins: response.service.duration,
          description: response.service.description,
        },
        eaCustomer: {
          id: response.customer.id,
          name: response.customer.firstName + " " + response.customer.lastName,
          email: response.customer.email,
          phone: response.customer.phone,
        },
      }
    } catch (error) {
      console.log(error)
      Sentry.captureException(error)
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

      return {
        eaAppointmentId: response.id,
        start: response.start,
        end: response.end,
        location: response.location,
        timezone: response.timezone,
        notes: response.notes,
        eaProvider: {
          id: response.provider.id,
          name: response.provider.firstName + " " + response.provider.lastName,
          email: response.provider.email,
          type: response.provider.type,
        },
        eaService: {
          id: response.service.id,
          name: response.service.name,
          durationInMins: response.service.duration,
          description: response.service.description,
        },
        eaCustomer: {
          id: response.customer.id,
          name: response.customer.firstName + " " + response.customer.lastName,
          email: response.customer.email,
          phone: response.customer.phone,
        },
      }
    } catch (error) {
      console.log(error)
      Sentry.captureException(error)
      throw new ApolloError(error.message, "ERROR")
    }
  }

  async cancelAppointment(eaAppointmentId: string) {
    try {
      const { data } = await this.axios.delete(
        `/appointments/${eaAppointmentId}`
      )

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

      return {
        eaAppointmentId: response.id,
        start: response.start,
        end: response.end,
        location: response.location,
        timezone: response.timezone,
        notes: response.notes,
        eaProvider: {
          id: response.provider.id,
          name: response.provider.firstName + " " + response.provider.lastName,
          email: response.provider.email,
          type: response.provider.type,
        },
        eaService: {
          id: response.service.id,
          name: response.service.name,
          durationInMins: response.service.duration,
          description: response.service.description,
        },
        eaCustomer: {
          id: response.customer.id,
          name: response.customer.firstName + " " + response.customer.lastName,
          email: response.customer.email,
          phone: response.customer.phone,
        },
      }
    } catch (error) {
      Sentry.captureException(error)
      throw new ApolloError("Could not find appointment.", "NOT_FOUND")
    }
  }

  async upcomingAppointments(
    user: Context["user"],
    input: UpcomingAppointmentsInput
  ) {
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

      const { data } = await this.axios.get("/appointments/upcoming", {
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
      })

      const apps = data.map((response: any) => ({
        eaAppointmentId: response.id,
        start: response.start,
        end: response.end,
        location: response.location,
        timezone: response.timezone,
        notes: response.notes,
        eaProvider: {
          id: response.provider.id,
          name: response.provider.firstName + " " + response.provider.lastName,
          email: response.provider.email,
          type: response.provider.type,
        },
        eaService: {
          id: response.service.id,
          name: response.service.name,
          durationInMins: response.service.duration,
          description: response.service.description,
        },
        eaCustomer: {
          id: response.customer.id,
          name: response.customer.firstName + " " + response.customer.lastName,
          email: response.customer.email,
          phone: response.customer.phone,
        },
      }))

      return apps
    } catch (error) {
      Sentry.captureException(error)
      throw new ApolloError(error.message, "ERROR")
    }
  }

  async getAppointmentsByMonth(
    user: Context["user"],
    input: GetAppointmentsByMonthInput
  ) {
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

      const { data } = await this.axios.get("/appointments/month", {
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
      })

      const apps = data.map((response: any) => ({
        eaAppointmentId: response.id,
        start: response.start,
        end: response.end,
        location: response.location,
        timezone: response.timezone,
        notes: response.notes,
        eaProvider: {
          id: response.provider.id,
          name: response.provider.firstName + " " + response.provider.lastName,
          email: response.provider.email,
          type: response.provider.type,
        },
        eaService: {
          id: response.service.id,
          name: response.service.name,
          durationInMins: response.service.duration,
          description: response.service.description,
        },
        eaCustomer: {
          id: response.customer.id,
          name: response.customer.firstName + " " + response.customer.lastName,
          email: response.customer.email,
          phone: response.customer.phone,
        },
      }))

      return apps
    } catch (error) {
      Sentry.captureException(error)
      throw new ApolloError(error.message, "ERROR")
    }
  }

  async getAppointmentsByDate(
    user: Context["user"],
    input: GetAppointmentsByDateInput
  ) {
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

      const { data } = await this.axios.get("/appointments/date", {
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
      })

      const apps = data.map((response: any) => ({
        eaAppointmentId: response.id,
        start: response.start,
        end: response.end,
        location: response.location,
        timezone: response.timezone,
        notes: response.notes,
        eaProvider: {
          id: response.provider.id,
          name: response.provider.firstName + " " + response.provider.lastName,
          email: response.provider.email,
          type: response.provider.type,
        },
        eaService: {
          id: response.service.id,
          name: response.service.name,
          durationInMins: response.service.duration,
          description: response.service.description,
        },
        eaCustomer: {
          id: response.customer.id,
          name: response.customer.firstName + " " + response.customer.lastName,
          email: response.customer.email,
          phone: response.customer.phone,
        },
      }))

      return apps
    } catch (error) {
      Sentry.captureException(error)
      throw new ApolloError(error.message, "ERROR")
    }
  }

  async updateProvider(eaProviderId: string, providerData: IEAProvider) {
    try {
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

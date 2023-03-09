import * as Sentry from "@sentry/node"
import { ApolloError } from "apollo-server"
import axios, { AxiosInstance } from "axios"
import config from "config"
import { Booking, CalAvailability } from "../schema/scheduler.schema"
import { ProviderModel } from "../schema/provider.schema"

class SchedulerService {
  public baseUrl: string
  public eaBaseUrl: string
  public axios: AxiosInstance

  constructor() {
    this.baseUrl = config.get("calApiUrl")
    this.axios = axios.create({
      baseURL: this.baseUrl,
      headers: {
        "Content-Type": "application/json",
      },
    })
  }

  async getProviderAvailability(
    email: string,
    eventId = 1
  ): Promise<CalAvailability> {
    let response: CalAvailability
    const { notFound, calIdNotFound } = config.get("errors.provider") as any
    const provider = await ProviderModel.find().findByEmail(email).lean()

    if (!provider) {
      throw new ApolloError(notFound.message, notFound.code)
    }

    // if (!provider.calId) {
    //   throw new ApolloError(calIdNotFound.message, calIdNotFound.code)
    // }

    try {
      const { data: userData } = await this.axios.get(
        `/v1/users/${provider.calId || 1}?apiKey=${process.env.CAL_API_KEY}`
      )

      // if (!userData?.defaultScheduleId) {
      //   throw new ApolloError("Default schedule id not found", "NOT_FOUND")
      // }

      const schedulePromise = this.axios.get(
        `/schedules/${userData?.defaultScheduleId || 1}?apiKey=${
          process.env.CAL_API_KEY
        }`
      )
      const eventTypePromise = this.axios.get(
        `/event-types/1?apiKey=${process.env.CAL_API_KEY}`
      )
      // const bookingsPromise = this.axios.get(
      //   `/bookings/?apiKey=${process.env.CAL_API_KEY}`
      // )

      const [
        scheduleResponse,
        eventTypeResponse,
        // bookingsResponse
      ] = await Promise.all([
        schedulePromise,
        eventTypePromise,
        // bookingsPromise
      ])

      // provider schedule
      const schedule = scheduleResponse.data.schedule
      // event info
      const length = eventTypeResponse.data.event_type.length
      const beforeEventBuffer =
        eventTypeResponse.data.event_type.beforeEventBuffer
      const afterEventBuffer =
        eventTypeResponse.data.event_type.afterEventBuffer
      const minimumBookingNotice =
        eventTypeResponse.data.event_type.minimumBookingNotice

      // const bookings =
      //   bookingsResponse.data.bookings?.length > 0
      //     ? bookingsResponse.data.bookings.filter(
      //         (booking: any) => booking.userId === userData.id
      //       )
      //     : []

      response = {
        schedule,
        eventType: {
          length,
          beforeEventBuffer,
          afterEventBuffer,
          minimumBookingNotice,
        },
        // bookings,
      }
      return response
    } catch (err) {
      Sentry.captureException(err)
      throw new ApolloError(err.message, "ERROR")
    }
  }

  async getBookings(): Promise<Booking[]> {
    try {
      const { data } = await this.axios.get(
        `/bookings/?apiKey=${process.env.CAL_API_KEY}`
      )
      return data.bookings
    } catch (err) {
      Sentry.captureException(err)
      throw new ApolloError(err.message, "ERROR")
    }
  }

  async getUsers() {
    try {
      const { data } = await this.axios.get(
        `/users?apiKey=${process.env.CAL_API_KEY}`
      )
      console.log(data)
      return data
    } catch (error) {
      console.log(error)
      Sentry.captureException(error)
      throw new ApolloError(error.message, "ERROR")
    }
  }
}

export default SchedulerService

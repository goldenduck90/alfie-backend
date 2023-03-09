import * as Sentry from "@sentry/node"
import { ApolloError } from "apollo-server"
import axios, { AxiosInstance } from "axios"
import config from "config"
import { CalAvailability } from "../schema/scheduler.schema"
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

  async getProviderAvailability(email: string, eventId = 1): Promise<any> {
    let response
    const { notFound, calIdNotFound } = config.get("errors.provider") as any
    const provider = await ProviderModel.find().findByEmail(email).lean()

    if (!provider) {
      throw new ApolloError(notFound.message, notFound.code)
    }

    if (!provider.calId) {
      throw new ApolloError(calIdNotFound.message, calIdNotFound.code)
    }

    try {
      const testProvider = { ...provider, calId: 1 }

      const { data: scheduleData } = await this.axios.get(
        `/schedules/${testProvider.calId}?apiKey=${process.env.CAL_API_KEY}`
      )
      const { data: eventTypeData } = await this.axios.get(
        `/event-types/${eventId}?apiKey=${process.env.CAL_API_KEY}`
      )

      const { data: bookingsData } = await this.axios.get(
        `/bookings/?apiKey=${process.env.CAL_API_KEY}`
      )

      // // Provider schedule info
      // const schedule = calSchedulesResponse.data.schedule
      // // Event info
      // const eventLength = eventTypeResponse.data.length
      // const beforeEventBuffer = eventTypeResponse.data.event_type.beforeEventBuffer
      // const afterEventBuffer = eventTypeResponse.data.event_type.afterEventBuffer
      // const minimumBookingNotice = eventTypeResponse.data.event_type.minimumBookingNotice

      return response
    } catch (err) {
      console.log("<ERROR>\n", err)
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

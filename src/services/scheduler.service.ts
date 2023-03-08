import * as Sentry from "@sentry/node"
import { ApolloError } from "apollo-server"
import axios, { AxiosInstance } from "axios"
import config from "config"
import { ProviderModel } from "../schema/provider.schema"

class SchedulerService {
  public baseUrl: string
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

  async getProviderAvailability(email: string, eaProviderId: string) {
    const { notFound, calIdNotFound } = config.get("errors.provider") as any
    const provider = await ProviderModel.find().findByEmail(email).lean()

    if (!provider) {
      throw new ApolloError(notFound.message, notFound.code)
    }
    if (!provider.calId) {
      throw new ApolloError(calIdNotFound.message, calIdNotFound.code)
    }

    const eventId = "default"
    try {
      const { data: providerCalSchedule } = await this.axios.get(
        `/schedules/${provider.calId}`
      )
      const { data: eventTypes } = await this.axios.get(
        `/event-types/${eventId}`
      )
      const { data: providerAppointments } = await this.axios.get(
        `/appointments/all/${eaProviderId}`
      )

      // TODO: call to fetch event types
      // TODO: get current booking availabilities
      return { availabilities: [] }
    } catch (err) {
      Sentry.captureException(err)
    }

    return provider[0]
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

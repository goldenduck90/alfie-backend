import { ApolloError } from "apollo-server"
import axios, { AxiosInstance } from "axios"
import { ProviderModel } from "../schema/provider.schema"
import config from "config"
import * as Sentry from "@sentry/node"

class CalService {
  public baseUrl: string
  public axios: AxiosInstance

  constructor() {
    this.baseUrl = process.env.CAL_API_URL || "CAL_API_URL not found"
    this.axios = axios.create({
      baseURL: this.baseUrl,
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer letmein1",
      },
    })
  }

  async getProviderSchedules(email: string) {
    const { notFound, calIdNotFound } = config.get("errors.provider") as any
    const provider = await ProviderModel.find().findByEmail(email).lean()

    if (!provider) {
      throw new ApolloError(notFound.message, notFound.code)
    }
    if (!provider.calId) {
      throw new ApolloError(calIdNotFound.message, calIdNotFound.code)
    }

    try {
      const { data } = await this.axios.get(`/v1/schedules/${provider.calId}`)
      // TODO: call to fetch event types
      // TODO: get current booking availabilities
      return data
    } catch (err) {
      Sentry.captureException(err)
    }

    return provider[0]
  }
}

export default CalService

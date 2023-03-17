import * as Sentry from "@sentry/node"
import { ApolloError } from "apollo-server"
import axios, { AxiosInstance } from "axios"
import config from "config"
import {
  CreateBookingInput,
  BookingResponse,
  CalAvailability,
  ScheduleAvailability,
  UpdateBookingInput,
} from "../schema/scheduler.schema"
import { ProviderModel } from "../schema/provider.schema"
import dayjs from "dayjs"

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

  async createScheduleAvailability({
    scheduleId,
    days,
    startTime,
    endTime,
  }: ScheduleAvailability): Promise<any> {
    const payload = {
      scheduleId,
      days,
      startTime,
      endTime,
    }
    try {
      const { data } = await this.axios.post(
        `/v1/availabilities?apiKey=${process.env.CAL_API_KEY}`,
        payload
      )
      return data
    } catch (err) {
      Sentry.captureException(err)
      throw new ApolloError(err.message, "ERROR")
    }
  }

  async getScheduleAvailabilityById(id: number): Promise<any> {
    try {
      const { data } = await this.axios.post(
        `/v1/availabilities/${id}?apiKey=${process.env.CAL_API_KEY}`
      )
      return data
    } catch (err) {
      Sentry.captureException(err)
      throw new ApolloError(err.message, "ERROR")
    }
  }

  async updateScheduleAvailability(id: number): Promise<any> {
    try {
      const { data } = await this.axios.post(
        `/v1/availabilities/${id}?apiKey=${process.env.CAL_API_KEY}`
      )
      return data
    } catch (err) {
      Sentry.captureException(err)
      throw new ApolloError(err.message, "ERROR")
    }
  }

  async getProviderAvailability(
    email: string,
    dateFrom: string,
    dateTo: string,
    timeZone: string
  ): Promise<CalAvailability> {
    const { notFound, calIdNotFound } = config.get("errors.provider") as any
    const provider = await ProviderModel.find().findByEmail(email).lean()
    if (!provider) {
      throw new ApolloError(notFound.message, notFound.code)
    }
    if (!provider.calId) {
      throw new ApolloError(calIdNotFound.message, calIdNotFound.code)
    }

    try {
      const { data: userData } = await this.axios.get(
        `/v1/users${provider.calId}?apiKey=${process.env.CAL_API_KEY}`
      )

      if (!userData?.defaultScheduleId) {
        throw new ApolloError("Default schedule id not found", "NOT_FOUND")
      }
      const today = dayjs()
      const tomorrow = today.add(1, "day")
      const todayString = today.format("YYYY-MM-DD")
      const tomorrowString = tomorrow.format("YYYY-MM-DD")

      const { data } = await this.axios.get(
        `/availability?userId=${provider.calId || 1}&dateFrom=${
          dateFrom || todayString
        }&eventTypeId=1&timeZone=${timeZone}&dateTo=${
          dateTo || tomorrowString
        }?apiKey=${process.env.CAL_API_KEY}`
      )

      // provider availability
      const { availabilities, busy, minimumBookingNotice } = data

      return {
        availabilities,
        busy,
        minimumBookingNotice,
        timeZone,
      }
    } catch (err) {
      Sentry.captureException(err)
      throw new ApolloError(err.message, "ERROR")
    }
  }

  async createBooking(booking: CreateBookingInput) {
    const payload = booking
    try {
      const { data } = await this.axios.post(
        `/v1/bookings?apiKey=${process.env.CAL_API_KEY}`,
        payload
      )
      return data
    } catch (err) {
      Sentry.captureException(err)
      throw new ApolloError(err.message, "ERROR")
    }
  }

  async updateBooking(booking: UpdateBookingInput) {
    const payload = booking
    try {
      const { data } = await this.axios.patch(
        `/v1/bookings/${booking.id}?apiKey=${process.env.CAL_API_KEY}`,
        payload
      )
      return data
    } catch (err) {
      Sentry.captureException(err)
      throw new ApolloError(err.message, "ERROR")
    }
  }

  async deleteBooking(id: number) {
    try {
      const { data } = await this.axios.delete(
        `/v1/bookings/${id}/cancel?apiKey=${process.env.CAL_API_KEY}`
      )
      return data
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
      return data
    } catch (error) {
      console.log(error)
      Sentry.captureException(error)
      throw new ApolloError(error.message, "ERROR")
    }
  }
}

export default SchedulerService

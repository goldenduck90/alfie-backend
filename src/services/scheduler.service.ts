import * as Sentry from "@sentry/node"
import { ApolloError } from "apollo-server"
import axios, { AxiosInstance } from "axios"
import config from "config"
import {
  CreateBookingInput,
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
    this.baseUrl = "http://localhost:3002"
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
        `/availabilities&apiKey=${process.env.CAL_API_KEY}`,
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
        `/availabilities/${id}&apiKey=${process.env.CAL_API_KEY}`
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
        `/availabilities/${id}&apiKey=${process.env.CAL_API_KEY}`
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
    timezone: string
  ): Promise<CalAvailability> {
    const { notFound, calIdNotFound } = config.get("errors.provider") as any
    const provider = await ProviderModel.find().findByEmail(email).lean()
    if (!provider) {
      throw new ApolloError(notFound.message, notFound.code)
    }
    // TODO: uncomment once providers have their calIds set
    // if (!provider.calId) {
    //   throw new ApolloError(calIdNotFound.message, calIdNotFound.code)
    // }

    try {
      // TODO: 401 here and is supposed to be called by an admin but works in postman
      // const usersUrl = `/users/${provider.calId || 1}&apiKey=${
      //   process.env.CAL_API_KEY
      // }`
      // const { data: userData } = await this.axios.get(usersUrl)

      // if (!userData?.defaultScheduleId) {
      //   throw new ApolloError("Default schedule id not found", "NOT_FOUND")
      // }

      const today = dayjs()
      const tomorrow = today.add(1, "day")
      const todayString = today.format("YYYY-MM-DD")
      const tomorrowString = tomorrow.format("YYYY-MM-DD")
      const userId = 1 // use from userData above once uncommented

      const url = `/availability?userId=${userId}&eventTypeId=1&timeZone=${timezone}&dateFrom=${
        dateFrom || todayString
      }&dateTo=${dateTo || tomorrowString}&apiKey=${process.env.CAL_API_KEY}`

      const { data } = await this.axios.get(url)

      // provider availability
      const { availabilities, busy, timeZone } = data

      return {
        availabilities,
        busy,
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
        `/bookings&apiKey=${process.env.CAL_API_KEY}`,
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
        `/bookings/${booking.id}&apiKey=${process.env.CAL_API_KEY}`,
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
        `/bookings/${id}/cancel&apiKey=${process.env.CAL_API_KEY}`
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
        `/users&apiKey=${process.env.CAL_API_KEY}`
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

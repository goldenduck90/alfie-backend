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
    this.eaBaseUrl = "https://ea.joinalfie.com/index.php/api/v1"
    this.axios = axios.create({
      baseURL: this.baseUrl,
      headers: {
        "Content-Type": "application/json",
      },
    })
  }

  async getProviderAvailability(
    email: string,
    eaProviderId: string,
    eventId = 1
  ): Promise<any> {
    const { notFound, calIdNotFound } = config.get("errors.provider") as any
    const provider = await ProviderModel.find().findByEmail(email).lean()

    if (!provider) {
      throw new ApolloError(notFound.message, notFound.code)
    }
    // if (!provider.calId) {
    //   throw new ApolloError(calIdNotFound.message, calIdNotFound.code)
    // }

    //   "event_types": [
    //     {
    //         "id": 1,
    //         "title": "30 Min Meeting",
    //         "slug": "30min",
    //         "length": 30,
    //         "hidden": false,
    //         "position": 0,
    //         "userId": 1,
    //         "teamId": null,
    //         "eventName": "",
    //         "timeZone": null,
    //         "periodType": "UNLIMITED",
    //         "periodStartDate": "2023-03-06T20:38:19.960Z",
    //         "periodEndDate": "2023-03-06T20:38:19.960Z",
    //         "periodDays": null,
    //         "periodCountCalendarDays": false,
    //         "requiresConfirmation": false,
    //         "recurringEvent": null,
    //         "disableGuests": false,
    //         "hideCalendarNotes": false,
    //         "minimumBookingNotice": 360,
    //         "beforeEventBuffer": 0,
    //         "afterEventBuffer": 120,
    //         "schedulingType": null,
    //         "price": 0,
    //         "currency": "usd",
    //         "slotInterval": null,
    //         "successRedirectUrl": null,
    //         "description": "",
    //         "locations": [],
    //         "metadata": {
    //             "apps": {
    //                 "giphy": {
    //                     "enabled": false,
    //                     "thankYouPage": ""
    //                 },
    //                 "stripe": {
    //                     "price": 0,
    //                     "enabled": false,
    //                     "currency": "usd"
    //                 },
    //                 "rainbow": {
    //                     "enabled": false,
    //                     "blockchainId": 0,
    //                     "smartContractAddress": ""
    //                 }
    //             },
    //             "additionalNotesRequired": false
    //         },
    //         "seatsPerTimeSlot": null,
    //         "seatsShowAttendees": false
    //     }
    // ]

    try {
      const testProvider = { ...provider, calId: 1 }
      const schedulesResponse = await this.axios.get(
        `/schedules/${testProvider.calId}?apiKey=${process.env.CAL_API_KEY}`
      )
      const eventTypesResponse = await this.axios.get(
        `/event-types/${eventId}?apiKey=${process.env.CAL_API_KEY}`
      )
      // const allAppointmentsResponse = await this.axios.get(
      //   `/appointments/all/${eaProviderId}`,
      //   { baseURL: this.eaBaseUrl }
      // )
      // console.log(allAppointmentsResponse)
      const responses = await Promise.all([
        schedulesResponse,
        eventTypesResponse,
        // allAppointmentsResponse,
      ])
      if (
        responses[0].status === 200 &&
        responses[1].status === 200
        //&& responses[2].status === 200
      ) {
        console.log("schedule data: ", schedulesResponse.data.schedule)
        console.log("event types data: ", eventTypesResponse.data.event_type)
        //   console.log("all appointments data: ", allAppointmentsResponse.data)
      }

      // TODO: parse responses
      const availability: CalAvailability = { availability: "1" }
      return availability
    } catch (err) {
      Sentry.captureException(err)
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

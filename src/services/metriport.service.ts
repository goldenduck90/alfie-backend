import { ApolloError } from "apollo-server"
import { MetriportDevicesApi } from "@metriport/api"
import { Address, Gender, UserModel } from "../schema/user.schema"
import {
  MetriportConnectResponse,
  MetriportMedicalDataModel,
} from "../schema/metriport.schema"
import { addMonths, format } from "date-fns"
import { FacilityModel } from "../schema/facility.schema"
import { captureEvent, captureException } from "../utils/sentry"
import { MetriportMedicalApi } from "@metriport/api-sdk"

export type ConsolidatedPatient = {
  patientId: string
  status: string
  filters: {
    resources: string
  }
  bundle: {
    type: string
    resourceType: string
    total: number
    entry: any[]
  }
}

export type ConversionPatient = {
  patientId: string
  type: string
  status: string
  documents: any[]
}

export interface MetriportUser {
  userId: string
  providers?: string[]
  body?: {
    weight_samples_kg?: {
      time: Date
      value: number
      date_source: {
        id?: string | null
        name?: string | null
        type?: string | null
        source_type?: string | null
      }
    }[]
  }[]
}
class MetriportService {
  private client: MetriportDevicesApi
  private medicalClient: MetriportMedicalApi

  constructor() {
    const sandbox = process.env.NODE_ENV !== "production"
    this.client = new MetriportDevicesApi(process.env.METRIPORT_API_KEY, {
      sandbox,
    })

    this.medicalClient = new MetriportMedicalApi(
      process.env.METRIPORT_API_KEY,
      {
        sandbox,
      }
    )
  }

  async runPatientJob() {
    try {
      const sixMonthsAgo = new Date()
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

      const users = await UserModel.find({
        metriportPatientId: { $exists: true },
        metriportDocumentQueryId: { $exists: false },
        $or: [
          { lastMetriportConsolidatedQuery: { $exists: false } },
          { lastMetriportConsolidatedQuery: { $lt: sixMonthsAgo } },
        ],
      }).select("_id")

      console.log(
        `[METRIPORT DOCUMENT JOB][${new Date().toString()}] ${
          users.length
        } PATIENTS TO PROCESS`
      )

      for (const user of users) {
        try {
          const response = await this.startDocumentQuery({ userId: user._id })
          console.log(
            `[METRIPORT DOCUMENT JOB][${new Date().toString()}] ${
              user._id
            } STARTED DOCUMENT QUERY: ${response}`
          )
        } catch (err2) {
          console.log(
            `[METRIPORT DOCUMENT JOB][${new Date().toString()}] ${
              user._id
            } FAILED DOCUMENT QUERY!`
          )
          console.log(err2)
        }
      }
    } catch (err) {
      console.log("An error occured in the metriport document job!")
      captureException(err, "Metirport document job error")
      return err
    }
  }

  async parseConsolidatedData({
    metriportPatientId,
    resources,
    entries,
  }: {
    metriportPatientId: string
    resources: string[]
    entries: any[]
  }): Promise<boolean> {
    try {
      const user = await UserModel.findOne({ metriportPatientId })
      const medicalEntry = await MetriportMedicalDataModel.findOne({
        user: user._id,
      })
      if (!medicalEntry) {
        await MetriportMedicalDataModel.create({
          user: user._id,
          resources,
          entries,
        })
        user.lastMetriportConsolidatedQuery = new Date()
        user.metriportDocumentQueryId = undefined
        await user.save()
        return true
      }

      medicalEntry.entries.push(entries)
      const newResources = resources.filter((r) =>
        medicalEntry.resources.includes(r)
      )
      medicalEntry.resources = [...medicalEntry.resources, ...newResources]
      await medicalEntry.save()
      user.lastMetriportConsolidatedQuery = new Date()
      user.metriportDocumentQueryId = undefined
      await user.save()

      return true
    } catch (err) {
      console.log(
        `An error occured parsing consolidated data for patient in metriport: ${metriportPatientId}`
      )
      captureException(err, "Metirport parsing consolidated data error", {
        metriportPatientId,
        resources,
      })
      return err
    }
  }

  async startConsolidatedDataQuery({
    metriportPatientId,
  }: {
    metriportPatientId: string
  }): Promise<"processing" | "completed"> {
    try {
      const user = await UserModel.findOne({ metriportPatientId })
      if (!user) {
        throw Error(
          `Could not find user for metriport patient id: ${metriportPatientId}`
        )
      }

      const sixMonthsAgo = format(addMonths(new Date(), -6), "yyyy-MM-dd")
      const today = format(new Date(), "yyyy-MM-dd")

      const response = await this.medicalClient.startConsolidatedQuery(
        metriportPatientId,
        [
          "Condition",
          "MedicationAdministration",
          "MedicationRequest",
          "AllergyIntolerance",
        ],
        sixMonthsAgo,
        today
      )

      user.metriportConsolidatedQueryStatus = response
      await user.save()

      if (response === "failed") {
        throw Error(`Consolidated document query failed for user: ${user._id}`)
      }

      captureEvent(
        "info",
        "Started consolidated data query for metriport user",
        {
          metriportPatientId,
          status: response,
        }
      )

      return response
    } catch (err) {
      console.log(
        `An error occured starting consolidated query for patient in metriport: ${metriportPatientId}`
      )
      captureException(err, "Metirport consolidated query start error", {
        metriportPatientId,
      })
      return err
    }
  }

  async startDocumentQuery({ userId }: { userId: string }): Promise<string> {
    try {
      const user = await UserModel.findById(userId)
      if (user.metriportFacilityId || user.metriportPatientId) {
        throw Error(
          `User does not have a metriport facility and/or patient id: ${userId}`
        )
      }

      const response = await this.medicalClient.startDocumentQuery(
        user.metriportPatientId,
        user.metriportFacilityId
      )
      user.metriportDocumentQueryId = response.requestId
      await user.save()

      captureEvent("info", "Started document query for metriport user", {
        userId: user._id,
        metriportPatientId: user.metriportPatientId,
        metriportFacilityId: user.metriportFacilityId,
        requestId: response.requestId,
      })

      return response.requestId
    } catch (err) {
      console.log(
        `An error occured starting document query for patient in metriport: ${userId}`
      )
      captureException(err, "Metirport document query start error", {
        userId,
      })
      return err
    }
  }

  async createPatient({
    userId,
    name,
    dob,
    gender,
    address,
  }: {
    userId?: string
    name: string
    dob: Date
    gender: Gender
    address: Address
  }): Promise<string> {
    try {
      const facility = await FacilityModel.findOne({ states: address.state })
      if (!facility) {
        throw Error(`Could not find a facility in the state: ${address.state}`)
      }

      const genderAtBirth = gender === Gender.Male ? "M" : "F"
      const formatDob = format(dob, "yyyy-MM-dd")

      const parts = name.trim().split(" ") // Split the name into parts, trimming any extra whitespace
      const firstName = parts[0] || "" // The first part is the first name
      const lastName = parts.length > 1 ? parts.slice(1).join(" ") : "" // Join the remaining parts for the last name

      console.log(facility)

      const response = await this.medicalClient.createPatient(
        {
          address: {
            addressLine1: address.line1,
            addressLine2: address.line2 || "",
            city: address.city,
            state: address.state,
            zip: address.postalCode,
            country: "USA",
          },
          firstName,
          lastName,
          dob: formatDob,
          genderAtBirth,
        },
        facility.metriportId.toString()
      )

      if (userId) {
        const resp = await UserModel.updateOne(
          {
            metriportPatientId: response.id,
            metriportFacilityId: facility.metriportId,
          },
          { _id: userId }
        )
        if (!resp.acknowledged)
          throw Error(
            `Could not update user in DB with metriport patient id: ${response.id}`
          )
      }

      captureEvent("info", "Created metriport patient for user", {
        userId: userId,
        metriportPatientId: response.id,
        metriportFacilityId: facility.metriportId,
      })

      return response.id
    } catch (err) {
      console.log(
        `An error occured creating patient in metriport: ${JSON.stringify({
          userId,
          name,
          dob,
          gender,
          address,
        })}`
      )
      captureException(err, "Metirport create patient error", {
        userId,
        name,
        dob,
        gender,
        address,
      })
      return err
    }
  }

  async createConnectToken(userId: string): Promise<MetriportConnectResponse> {
    try {
      let metriportUserId
      const user = await UserModel.findById(userId)
      metriportUserId = user.metriportUserId

      if (!metriportUserId) {
        metriportUserId = await this.client.getMetriportUserId(userId)
        await UserModel.findByIdAndUpdate(userId, {
          metriportUserId,
        })
      }
      const token = await this.client.getConnectToken(metriportUserId)

      const url = new URL("https://connect.metriport.com/")
      url.searchParams.append("token", token)
      url.searchParams.append("providers", "withings")
      if (process.env.NODE_ENV !== "production")
        url.searchParams.append("sandbox", "true")

      return {
        url: url.href,
      }
    } catch (err) {
      throw new ApolloError(err.message, "ERROR")
    }
  }
}

export default MetriportService

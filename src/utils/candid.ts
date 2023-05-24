import * as Sentry from "@sentry/node"
import axios from "axios"
import config from "config"
import { addSeconds, isPast } from "date-fns"
import { IEAAppointment } from "../@types/easyAppointmentTypes"
import {
  AuthorizationTokenModel,
  AuthorizationToken,
} from "../schema/authorizationToken.schema"
import { LeanDocument } from "mongoose"
import { CandidEligibilityCheckRequest } from "../@types/candidTypes"
import cpids from "./cpids.json"
import dayjs from "dayjs"
import tz from "dayjs/plugin/timezone"
import utc from "dayjs/plugin/utc"
import advanced from "dayjs/plugin/advancedFormat"
import { User } from "../schema/user.schema"
import { Provider } from "../schema/provider.schema"

dayjs.extend(utc)
dayjs.extend(tz)
dayjs.extend(advanced)

export const candidInstance = axios.create({
  baseURL: config.get("candidHealth.apiUrl") as string,
  headers: {
    "Content-Type": "application/json; charset = utf8",
  },
})

export let candidHealthBearer: string | null = null

/**
 * Authenticate the candid API.
 */
export const authenticate = async () => {
  let token: LeanDocument<AuthorizationToken>

  const existingToken = await getSavedAuthorizationToken()
  if (existingToken) {
    token = existingToken
  } else {
    const clientId = config.get("candidHealth.clientId")
    const clientSecret = config.get("candidHealth.clientSecret")
    try {
      const { data, status } = await axios.post<{
        access_token: string
        expires_in: number
      }>("/v1/auth/token", {
        client_id: clientId,
        client_secret: clientSecret,
      })
      if (status === 200) {
        console.log(`candid health auth result: ${JSON.stringify(data)}`)
        const expiresAt = addSeconds(new Date(), data.expires_in - 60)
        token = await saveAuthorizationToken(data.access_token, expiresAt)
      } else {
        Sentry.captureMessage(
          `Non-200 candid health authentication result: ${status}, ${JSON.stringify(
            data
          )}`
        )
        throw new Error(
          `Candid Health API authenticate: ${status} error returned from /auth/token endpoint.`
        )
      }
    } catch (error) {
      Sentry.captureException(error)
      throw error
    }
  }

  candidHealthBearer = token.token
  candidInstance.defaults.headers.common[
    "Authorization"
  ] = `Bearer ${token.token}`

  return token
}

/** Gets a saved non-expired authorization token from the database, or null if none exists. */
export const getSavedAuthorizationToken = async () => {
  const existingToken = (await AuthorizationTokenModel.findOne({
    provider: "candid",
  })) as LeanDocument<AuthorizationToken>
  if (existingToken && !isPast(existingToken.expiresAt)) {
    return existingToken
  } else {
    return null
  }
}

/** Saves the given authorization token to authorizationtokens, overwriting the previous token. */
export const saveAuthorizationToken = async (
  token: string,
  expiresAt: Date
) => {
  try {
    const existingToken = (await AuthorizationTokenModel.findOne({
      provider: "candid",
    })) as LeanDocument<AuthorizationToken>
    const tokenObj: LeanDocument<AuthorizationToken> = {
      token,
      expiresAt,
      provider: "candid",
      refreshToken: undefined,
      refreshTokenExpiresAt: undefined,
    }

    if (existingToken) {
      return await AuthorizationTokenModel.findOneAndReplace(
        { provider: "candid" },
        tokenObj
      )
    } else {
      return await AuthorizationTokenModel.create(tokenObj)
    }
  } catch (error) {
    Sentry.captureException(error)
    return null
  }
}

/** Looks up a CPID by the payer ID and insurance provider name. */
export const lookupCPID = (
  payerId: string,
  primaryName: string
): string | null => {
  const result = cpids.find(
    ({ payer_id, primary_name }) =>
      payer_id === payerId || primary_name === primaryName
  )
  const payerIdResult = cpids.find(({ payer_id }) => payer_id === payerId)
  return result?.cpid ?? payerIdResult?.cpid ?? null
}

/** Check insurance eligibility with the Candid API. */
export const checkInsuranceEligibility = async (
  appointment: IEAAppointment,
  user: User,
  provider: Provider
) => {
  try {
    const [userFirstName, userLastName] = user.name.split(" ")

    const cpid = lookupCPID("1234", "Aetna")
    const eligibilityRequest: CandidEligibilityCheckRequest = {
      tradingPartnerServiceId: cpid,
      // encounter: {
      //   dateOfService: dayjs.tz(appointment.start, appointment.timezone).format("MM/DD/YYYY"),
      //   serviceTypeCodes: ["99"], // bariatric services
      // },
      provider: {
        firstName: provider.firstName,
        lastName: provider.lastName,
        npi: provider.npi,
        organizationName: "Alfie",
        // providerCode:
        // serviceProviderNumber:
        // federalTaxpayersIdNumber
        // referenceIdentification
      },
      subscriber: {
        dateOfBirth: dayjs.utc(user.dateOfBirth).format("MM/DD/YYYY"),
        firstName: userFirstName?.trim() || "",
        lastName: userLastName?.trim() || "",
        gender: user.gender.toLowerCase().startsWith("m") ? "M" : "F",
        memberId: "TODO: Insurance Member ID",
      },
    }

    candidInstance.post("/v0/eligiblity", eligibilityRequest)
  } catch (error) {
    Sentry.captureException(error)
  }
}

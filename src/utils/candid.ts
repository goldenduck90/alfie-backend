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
import {
  CandidCreateCodedEncounterRequest,
  CandidEligibilityCheckRequest,
  CandidEligibilityCheckResponse,
  CandidEncodedEncounterResponse,
} from "../@types/candidTypes"
import cpids from "./cpids.json"
import dayjs from "dayjs"
import tz from "dayjs/plugin/timezone"
import utc from "dayjs/plugin/utc"
import advanced from "dayjs/plugin/advancedFormat"
import { InsuranceEligibilityInput, User } from "../schema/user.schema"
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
  if (existingToken && !isPast(existingToken.expiresAt)) {
    token = existingToken
  } else {
    const clientId = config.get("candidHealth.clientId")
    const clientSecret = config.get("candidHealth.clientSecret")
    try {
      const { data, status } = await candidInstance.post<{
        access_token: string
        expires_in: number
      }>("/auth/v2/token", {
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
      console.log(`Error response: ${JSON.stringify(error.response?.data)}`)
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
  user: User,
  provider: Provider,
  input: InsuranceEligibilityInput,
  /** Optional. The CPID. Otherwise, uses fields from `input` to calculate. */
  cpid?: string
): Promise<CandidEligibilityCheckResponse> => {
  try {
    const [userFirstName, userLastName] = user.name.split(" ")

    // @todo which inputs to send to CPID lookup.
    cpid = cpid || lookupCPID(input.payor, input.groupName)
    const eligibilityRequest: CandidEligibilityCheckRequest = {
      trading_partner_service_id: cpid,
      provider: {
        // firstName: provider.firstName,
        first_name: provider.firstName,
        // lastName: provider.lastName,
        last_name: provider.lastName,
        npi: provider.npi,
        organization_name: "extra healthy insurance",
        //   // providerCode
        //   // serviceProviderNumber
        //   // federalTaxpayersIdNumber
        //   // referenceIdentification
      },
      subscriber: {
        date_of_birth: dayjs.utc(user.dateOfBirth).format("YYYYMMDD"),
        first_name: userFirstName?.trim() || "",
        last_name: userLastName?.trim() || "",
        gender: user.gender.toLowerCase().startsWith("m") ? "M" : "F",
        member_id: input.memberId,
      },
    }

    console.log(
      `Eligibility Request Param: ${JSON.stringify(
        eligibilityRequest,
        null,
        "  "
      )}`
    )

    const response = await candidInstance.post(
      "/v0/eligibility",
      eligibilityRequest
    )
    const { data } = response

    return data
  } catch (error) {
    console.log(
      "Candid eligibility request error",
      JSON.stringify(error.response?.data)
    )
    Sentry.captureException(error)
  }
}

/**
 * Create a insurance billing request based on an encounter (appointment).
 */
export const createCodedEncounter = async (
  user: User,
  provider: Provider,
  appointment: IEAAppointment,
  input: InsuranceEligibilityInput
) => {
  const [userFirstName, userLastName] = user.name.split(" ")
  // TODO should an eligibility check occur before individual insurance/encounter billing occurs after an appointment?
  const encounterRequest: CandidCreateCodedEncounterRequest = {
    external_id: `${user._id.toString()}-${appointment.eaAppointmentId}`,
    date_of_service: dayjs
      .tz(appointment.start, appointment.timezone)
      .format("YYYY-MM-DD"),
    patient_authorized_release: true,
    benefits_assigned_to_provider: true,
    provider_accepts_assignment: true,
    appointment_type: "Obesity Management",
    billing_provider: {
      // TODO: what is the billing provider information?
      organization_name: "Alfie",
      tax_id: "000000001",
      npi: "1942788757",
      address: {
        address1: "123 address1",
        address2: "000",
        city: "city2",
        state: "WA",
        zip_code: "37203",
        zip_plus_four_code: "0000",
      },
    },
    // TODO is service facility required? Same as patient home address?
    // service_facility: {},
    // TODO is the rendering provider Alfie, or the provider
    // as an individual
    rendering_provider: {
      first_name: provider.firstName,
      last_name: provider.lastName,
      npi: provider.npi,
      // address: {
      //   address1: provider.address.line1, // TODO
      // }
    },
    subscriber_primary: {
      first_name: userFirstName || "",
      last_name: userLastName || "",
      gender: user.gender?.toLowerCase() || "unknown",
      patient_relationship_to_subscriber_code: "18", // Self
      insurance_card: {
        member_id: input.memberId,
        payer_id: input.payor,
        payer_name: input.payor, // TODO: Payer ID, Payer Name source?
        group_number: input.groupId,
        rx_bin: input.rxBin, // TODO: should this be included in non-drug claim?
      },
    },
    patient: {
      first_name: userFirstName || "",
      last_name: userLastName || "",
      address: {
        address1: user.address.line1,
        address2: user.address.line2,
        city: user.address.city,
        state: user.address.state,
        zip_code: (user.address.postalCode || "").slice(0, 5),
        zip_plus_four_code: (user.address.postalCode || "").slice(5),
      },
      date_of_birth: dayjs
        .tz(user.dateOfBirth, user.timezone)
        .format("YYYYMMDD"),
      external_id: user._id.toString(),
      gender: user.gender?.toLowerCase() ?? "unknown",
    },
    diagnoses: [
      {
        code: "Z71.3", // Dietary counseling and surveillance
        code_type: "ABK",
      },
    ],
    // See https://www.cms.gov/Medicare/Coding/place-of-service-codes/Place_of_Service_Code_Set
    place_of_service_code: "10",
    service_lines: [
      {
        modifiers: ["95"], // 95 - Synchronous Telemedicine Service Rendered via a Real-Time Interactive Audio and Video Telecommunications System
        procedure_code: "99401", // TODO: CPT code for obesity management procedure?
        quantity: "1",
        units: "UN", // TODO is this correct?
        // charge_amount_cents: // TODO does this need to be specified?
        diagnosis_pointers: [0],
      },
    ],
    synchronicity: "Synchronous",
  }

  try {
    console.log(
      `Encoded encounter request: ${JSON.stringify(encounterRequest)}`
    )
    const { data } = await candidInstance.post<CandidEncodedEncounterResponse>(
      "/v1/coded_encounters",
      encounterRequest
    )
    console.log(`Encoded encounter result: ${JSON.stringify(data, null, "  ")}`)
    return data
  } catch (error) {
    console.log(
      "Candid create coded encounter error",
      JSON.stringify(error.response?.data)
    )
  }
}

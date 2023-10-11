import axios, { AxiosInstance } from "axios"
import { ApolloError } from "apollo-server-errors"
import config from "config"
import { addSeconds, isPast } from "date-fns"
import type { LeanDocument } from "mongoose"
import type { IEAAppointment } from "../@types/easyAppointmentTypes"
import { captureEvent, captureException } from "../utils/sentry"
import {
  AuthorizationTokenModel,
  AuthorizationToken,
} from "../schema/authorizationToken.schema"
import type {
  CandidAddressPlusFour,
  CandidCreateCodedEncounterRequest,
  CandidEncodedEncounterResponse,
  CandidEligibilityCheckRequest,
  CandidEligibilityCheckResponse,
  CandidRequestBillingProvider,
  RequestClinicalNote,
  CandidResponseError,
} from "../@types/candidTypes"
import dayjs from "../utils/dayjs"
import { User, UserModel, Weight } from "../schema/user.schema"
import { Provider } from "../schema/provider.schema"
import { TaskType } from "../schema/task.schema"
import { UserTask } from "../schema/task.user.schema"
import TaskService from "../services/task.service"
import { calculateSetting, SettingsList } from "../utils/calculateSetting"
import { calculateBMI } from "../utils/calculateBMI"
import { InsuranceDetails } from "../schema/insurance.schema"

export const authorizationTokenProvider = "candidhealth"

/** Events leading to creation of a coded encounter. */
export enum CodedEncounterSource {
  Appointment = "appointment",
  Scale = "scale",
}

export class CandidError extends ApolloError {}

export type BasicUserInfo = Pick<User, "name" | "dateOfBirth" | "gender"> & {
  state: string
}

interface CandidAuthResponse {
  /** The access token to use in authorization headers. */
  access_token: string
  /** Number of seconds until expiration. */
  expires_in: number
}

export default class CandidService {
  private candidInstance: AxiosInstance
  private baseUrl: string
  private clientId: string
  private clientSecret: string

  private taskService: TaskService

  constructor() {
    this.baseUrl = config.get("candidHealth.apiUrl") as string
    this.clientId = config.get("candidHealth.clientId") as string
    this.clientSecret = config.get("candidHealth.clientSecret") as string

    this.candidInstance = axios.create({
      baseURL: this.baseUrl,
      headers: {
        "Content-Type": "application/json; charset = utf8",
      },
    })

    this.taskService = new TaskService()
  }

  /**
   * Sets the authorization header on the candid axios instance for authenticated API calls.
   */
  private setAuthorizationBearer(token: string) {
    this.candidInstance.defaults.headers.common[
      "Authorization"
    ] = `Bearer ${token}`
  }

  /**
   * Generate and save a token for this application's client_id and client_secret.
   * Called automatically before each API call, using the cached token when possible.
   *
   * POST /auth/v2/token
   */
  public async authenticate() {
    let token: LeanDocument<AuthorizationToken>

    // retrieve the existing token and check if it is still valid
    const existingToken = await this.getSavedAuthorizationToken()
    if (existingToken && !isPast(addSeconds(existingToken.expiresAt, -60))) {
      token = existingToken
    } else {
      try {
        const { data } = await this.candidInstance.post<CandidAuthResponse>(
          "/auth/v2/token",
          {
            client_id: this.clientId,
            client_secret: this.clientSecret,
          }
        )
        const expiresAt = addSeconds(new Date(), data.expires_in)
        await this.saveAuthorizationToken(data.access_token, expiresAt)
        token = await this.getSavedAuthorizationToken()
      } catch (error) {
        captureException(
          error.response?.data ?? error,
          "CandidService.authenticate"
        )
        throw error
      }
    }

    this.setAuthorizationBearer(token.token)

    return token
  }

  /** Gets an authorization token for candidhealth from the database, or null if none exists. */
  public async getSavedAuthorizationToken(): Promise<LeanDocument<AuthorizationToken> | null> {
    const token: LeanDocument<AuthorizationToken> =
      await AuthorizationTokenModel.findOne({
        provider: authorizationTokenProvider,
      })

    return token
  }

  /** Saves the given OAuth 2.0 token to the authorizationTokens collection, updating any previously saved token if it exists. */
  private async saveAuthorizationToken(
    token: string,
    expiresAt: Date
  ): Promise<void> {
    try {
      const existingToken = await this.getSavedAuthorizationToken()
      const tokenObj: LeanDocument<AuthorizationToken> = {
        token,
        expiresAt,
        provider: authorizationTokenProvider,
        refreshToken: null,
        refreshTokenExpiresAt: null,
      }

      if (existingToken) {
        await AuthorizationTokenModel.findOneAndReplace(
          { provider: authorizationTokenProvider },
          tokenObj
        )
      } else {
        await AuthorizationTokenModel.create(tokenObj)
      }
    } catch (error) {
      captureException(error, "CandidService.saveAuthorizationToken")
      throw error
    }
  }

  /** Gets the candid encounter for the given appointment and user. */
  public async getEncounterForAppointment(
    appointment: IEAAppointment,
    user: User
  ): Promise<CandidEncodedEncounterResponse> {
    await this.authenticate()

    try {
      const { data } = await this.candidInstance.get("/v1/encounters", {
        params: {
          external_id: `${user._id.toString()}-${appointment.eaAppointmentId}`,
        },
      })
      return data[0]
    } catch (error) {
      captureException(
        error.response?.data ?? error,
        "CandidService.getEncounterForAppointment",
        {
          data: error.response?.data,
          appointment: appointment?.eaAppointmentId,
        }
      )
      throw new CandidError(
        error.response?.data?.message ??
          "Error getting encounter for appointment."
      )
    }
  }

  /** Check insurance eligibility for the patient with the given insurance card information. */
  public async checkInsuranceEligibility({
    user,
    insurance,
    cpid,
  }: {
    user: BasicUserInfo
    insurance: InsuranceDetails
    cpid: string
  }): Promise<{
    eligible: boolean
    payor?: {
      payorId: string
      payorName: string
    }
    errors: string[]
  }> {
    await this.authenticate()

    try {
      // check each insurance/cpid until an eligible result
      const { eligible, payor, errors, request, response } =
        await this.checkCPIDEligibility({
          user,
          insurance,
          cpid,
        })

      captureEvent(
        "info",
        `[CANDID] ELIGIBILITY CHECK: ${eligible ? "ELIGIBLE" : "NOT ELIGIBLE"}`,
        {
          eligible,
          payor,
          errors,
          request,
          response,
        }
      )
      return {
        eligible,
        payor,
        errors:
          errors && errors.length > 0
            ? errors.map((e) => `${e.code}: ${e.description}`)
            : [],
      }
    } catch (error) {
      captureException(error, "[CANDID] ELIGIBILITY CHECK: ERROR")
      return {
        eligible: false, // TODO: fix eligibility
        errors: [error?.message || "UNKNOWN_ERROR"],
      }
    }
  }

  /** Check insurance eligibility for the patient with the given insurance card information and CPID. */
  private async checkCPIDEligibility({
    user,
    insurance,
    cpid,
  }: {
    user: BasicUserInfo
    insurance: InsuranceDetails
    cpid: string
  }): Promise<{
    errors: CandidResponseError[]
    response?: CandidEligibilityCheckResponse
    request?: CandidEligibilityCheckRequest
    eligible: boolean
    payor?: {
      payorName: string
      payorId: string
    }
  }> {
    try {
      const [userFirstName, userLastName] = user.name
        .split(" ")
        .map((name) => name.trim())
      const settings: SettingsList = config.get("candidHealth.settings")

      const { billingProvider } = calculateSetting(
        settings,
        ["billingProvider"],
        {
          state: user.state.toUpperCase(),
        }
      )

      const request: CandidEligibilityCheckRequest = {
        tradingPartnerServiceId: cpid,
        provider: {
          npi: billingProvider.npi,
          organizationName: billingProvider.organization_name,
        },
        subscriber: {
          dateOfBirth: dayjs.utc(user.dateOfBirth).format("YYYYMMDD"),
          firstName: userFirstName || "",
          lastName: userLastName || "",
          gender: user.gender.toLowerCase().startsWith("m") ? "M" : "F",
          memberId: insurance.memberId,
        },
      }

      const { data } =
        await this.candidInstance.post<CandidEligibilityCheckResponse>(
          "/v0/eligibility",
          request
        )

      const errors = (data as any as { errors?: CandidResponseError[] }).errors
      if (errors?.length > 0) {
        return {
          eligible: false,
          request,
          response: data,
          errors,
        }
      }

      const { eligible, payorId, payorName } =
        this.getEligibilityFromResponse(data)
      return {
        eligible,
        payor: {
          payorId,
          payorName,
        },
        request,
        response: data,
        errors,
      }
    } catch (error) {
      return {
        eligible: false,
        errors: [],
      }
    }
  }

  /** Calculates eligibility information from a non-error eligibility check response. */
  private getEligibilityFromResponse(data: CandidEligibilityCheckResponse): {
    payorName: string
    payorId: string
    eligible: boolean
  } {
    const status = data.planStatus
    const eligible = status.some((item) => item.statusCode == "1")
    const payorName = data.payer.name
    const payorId = data.payer.payorIdentification

    return {
      payorName,
      payorId,
      eligible,
    }
  }

  /** Create a coded encounter for an appointment. */
  async createCodedEncounterForAppointment(
    appointment: IEAAppointment,
    initialAppointment?: IEAAppointment
  ) {
    const user = await UserModel.findOne({
      eaCustomerId: appointment.eaCustomer.id,
    }).populate<{ provider: Provider }>("provider")

    if (!user)
      throw new ApolloError(
        `User ${appointment.eaCustomer.id} on appointment not found during insurance billing.`
      )

    const { provider } = user
    if (!provider)
      throw new ApolloError(`User ${user._id.toString()} has no provider.`)

    const isInitialAppointment =
      !initialAppointment ||
      initialAppointment.eaAppointmentId === appointment.eaAppointmentId

    // if a follow-up appointment, retrieve the initial claim to find the procedure code.
    const initialEncounter = isInitialAppointment
      ? null
      : await this.getEncounterForAppointment(initialAppointment, user)

    const initialProcedureCode: string | null =
      initialEncounter?.clinical_notes
        ?.find((note) => note.category === "procedure")
        ?.notes[0]?.trim() ?? null

    const timestamp = dayjs.tz(appointment.start, appointment.timezone).toDate()

    // prevent DuplicateEncounterException in development
    const sandboxExternalId =
      process.env.NODE_ENV === "development" ||
      process.env.NODE_ENV === "staging"
        ? `-${Math.floor(Math.random() * 1e5)}`
        : ""

    return await this.createCodedEncounter(
      user,
      provider,
      user.insurance,
      CodedEncounterSource.Appointment,
      "Obesity management",
      timestamp,
      `${user._id.toString()}-${
        appointment.eaAppointmentId
      }${sandboxExternalId}`,
      {
        // whether this is the initial appointment
        initial: isInitialAppointment,
        // procedure code for the initial appointment
        initialProcedureCode,
      },
      // 95 - Synchronous Telemedicine Service Rendered via a Real-Time Interactive Audio and Video Telecommunications System
      {
        serviceLineModifier: "95",
        placeOfServiceCode: "10",
      }
    )
  }

  /**
   * Creates a coded encounter for the user and given parameters, if the criteria indicate to do so.
   * Otherwise, returns null.
   */
  async createCodedEncounterForScaleEvent(
    /** The user. */
    user: User,
    /** The provider. */
    provider: Provider,
    /** All user weights including the newest. */
    weights: Weight[]
  ) {
    const currentMonth = dayjs().tz(user.timezone).format("YYYY-MM")

    const currentMonthWeights = weights
      .filter(({ scale }) => scale)
      .filter(({ date, scale }) => {
        const scaleMonth = dayjs(date).tz(user.timezone).format("YYYY-MM")
        return scale && currentMonth === scaleMonth
      })
    const firstMeasurement =
      weights.findIndex((weight) => weight.scale) === weights.length - 1
    const currentMonthMeasurements = currentMonthWeights.length
    const newWeight = weights.slice(-1)[0]

    if (firstMeasurement || currentMonthMeasurements === 16) {
      // prevent DuplicateEncounterException in development
      const sandboxExternalId =
        process.env.NODE_ENV === "development" ||
        process.env.NODE_ENV === "staging"
          ? `-${Math.floor(Math.random() * 1e5)}`
          : ""
      const measurementNote = firstMeasurement
        ? "First measurement with scale."
        : "16th measurement in current month with scale."

      const externalIdMarker = firstMeasurement
        ? "firstreading"
        : "16-" + dayjs.tz(newWeight.date, user.timezone).format("YYYY-MM")
      return await this.createCodedEncounter(
        user,
        provider,
        user.insurance,
        CodedEncounterSource.Scale,
        "Obesity management",
        newWeight.date,
        `${user._id.toString()}-scale-${externalIdMarker}${sandboxExternalId}`,
        {
          firstMeasurement,
          currentMonthMeasurements,
        },
        {
          placeOfServiceCode: "10",
          serviceLineModifier: "95",
          additionalClinicalNotes: [
            {
              category: "patient_info",
              notes: [
                {
                  author_name: `${provider.firstName} ${provider.lastName}`,
                  author_npi: provider.npi,
                  text: `Weight reading: ${newWeight.value}lbs. ${measurementNote}`,
                  timestamp: newWeight.date.toISOString(),
                },
              ],
            },
          ],
        }
      )
    } else {
      return null
    }
  }

  /** Create a coded encounter with the given information. */
  async createCodedEncounter(
    /** The patient. */
    user: User,
    /** The provider. */
    provider: Provider,
    /** Insurance information. */
    insurance: InsuranceDetails,
    /**
     * The source or reason for billing, sent to candidSettings during cost and
     * procedure code calculation.
     */
    source: CodedEncounterSource,
    /** A description note for the event. */
    description: string,
    /** When the event occurred. */
    timestamp: Date,
    /** An external ID to reference the encounter. */
    externalId: string,
    /**
     * A map of source-specific values to include in diagnosis, cost, and procedure code calculation.
     * The user's bmi, comorbidities, state,
     * @see candidHealth.develop.ts
     * @see candidHealth.production.ts
     */
    conditionsValues: Record<string, any>,
    encounterParams: {
      /**
       * Place of service code.
       * @see https://www.cms.gov/Medicare/Coding/place-of-service-codes/Place_of_Service_Code_Set
       */
      placeOfServiceCode: string
      /** Additional clinical notes. */
      additionalClinicalNotes?: RequestClinicalNote[]
      /** Service line modifier. */
      serviceLineModifier: string
    }
  ) {
    await this.authenticate()

    const settings: SettingsList = config.get("candidHealth.settings")

    if (
      process.env.NODE_ENV === "development" ||
      process.env.NODE_ENV === "staging"
    ) {
      const sandboxValues = getSandboxObjects(user, provider, insurance)
      user = sandboxValues.user
      provider = sandboxValues.provider
      insurance = sandboxValues.insurance
    }

    // calculate the billing provider for the claim
    const {
      billingProvider,
    }: { billingProvider?: CandidRequestBillingProvider } = calculateSetting(
      settings,
      ["billingProvider"],
      { state: user.address.state.toUpperCase() }
    )

    captureEvent(
      "info",
      "Candid eligibility check: selected billing provider.",
      {
        billingProvider,
        state: user.address.state.toUpperCase(),
      }
    )

    let userTasks: UserTask[]
    try {
      const { userTasks: userTasksResult } =
        await this.taskService.getUserTasks(user._id.toString(), {
          taskType: TaskType.NEW_PATIENT_INTAKE_FORM,
          completed: true,
          limit: 1,
        })

      userTasks = userTasksResult
    } catch (error) {
      throw new ApolloError(
        "The medical questionnaire must be filled out in order to process insurance claims."
      )
    }

    const userIntake = userTasks[0]

    const comorbidities = await this.getConditions(
      user,
      "conditions",
      userIntake
    )

    const latestWeight =
      Number(user.weights[user.weights.length - 1]?.value) ?? null

    // calculate BMI
    const bmi = calculateBMI(latestWeight, user.heightInInches)

    const calculationCriteria: Record<string, any> = {
      source,
      bmi,
      comorbidities: comorbidities.length,
      ...conditionsValues,
    }

    const {
      procedure: procedureCode,
      cost: costInCents,
      diagnosis: diagnosisCode,
    } = calculateSetting(
      settings,
      ["procedure", "cost", "diagnosis"],
      calculationCriteria
    )

    if (!procedureCode || !costInCents) {
      const logMessage =
        "Candid Create Coded Encounter Error: No procedure code or cost matches the criteria."
      captureEvent("warning", logMessage, {
        calculationCriteria,
      })
      throw new CandidError(logMessage)
    } else {
      const criteriaLog = `Procedure code ${procedureCode}, diagnosis code ${diagnosisCode} and cost ${costInCents} calculated from ${JSON.stringify(
        calculationCriteria
      )}.`
      captureEvent("info", criteriaLog, calculationCriteria)
    }

    // compile clinical notes
    const conditionTypeReplacements: Record<string, string> = {
      conditions: "Conditions",
      previousConditions: "Previous Conditions",
      medications: "Medications",
      hasSurgicalHistory: "Has Surgical History",
      allergies: "Allergies",
      weightManagementMethods: "Previous Weight Management Methods",
    }

    const previousConditionsText: string = (userIntake.answers ?? [])
      .filter((answer) =>
        [
          "conditions",
          "previousConditions",
          "medications",
          "hasSurgicalHistory",
          "allergies",
          "weightManagementMethods",
        ].includes(answer.key)
      )
      .filter((answer) => answer.value)
      .reduce(
        (conditions, answer) =>
          `${conditions}\n${conditionTypeReplacements[answer.key]}: ${
            answer.value
          }`,
        `Current BMI: ${bmi}`
      )

    const [userFirstName, userLastName] = user.name.split(" ")

    const patientAddress: CandidAddressPlusFour = {
      address1: user.address.line1,
      address2: user.address.line2,
      city: user.address.city,
      state: user.address.state,
      zip_code: (user.address.postalCode || "").slice(0, 5),
      zip_plus_four_code: (user.address.postalCode || "").slice(5).slice(-4),
    }

    const encounterRequest: CandidCreateCodedEncounterRequest = {
      external_id: externalId,
      date_of_service: dayjs.tz(timestamp, user.timezone).format("YYYY-MM-DD"),
      patient_authorized_release: true,
      benefits_assigned_to_provider: true,
      provider_accepts_assignment: true,
      appointment_type: description,
      billing_provider: billingProvider,
      rendering_provider: {
        first_name: provider.firstName,
        last_name: provider.lastName,
        npi: provider.npi,
      },
      subscriber_primary: {
        first_name: userFirstName || "",
        last_name: userLastName || "",
        gender: user.gender?.toLowerCase() || "unknown",
        patient_relationship_to_subscriber_code: "18", // Self
        address: patientAddress,
        insurance_card: {
          member_id: insurance.memberId,
          payer_id: insurance.payorId,
          payer_name: insurance.payorName,
          group_number: insurance.groupId,
          rx_bin: insurance.rxBIN,
          rx_pcn: insurance.rxPCN,
        },
      },
      patient: {
        first_name: userFirstName || "",
        last_name: userLastName || "",
        address: patientAddress,
        date_of_birth: dayjs
          .tz(user.dateOfBirth, user.timezone)
          .format("YYYYMMDD"),
        external_id: user._id.toString(),
        gender: user.gender?.toLowerCase() ?? "unknown",
      },
      diagnoses: [
        {
          code: diagnosisCode,
          code_type: "ABK", // ICD-10
        },
      ],
      // See https://www.cms.gov/Medicare/Coding/place-of-service-codes/Place_of_Service_Code_Set
      place_of_service_code: encounterParams.placeOfServiceCode, // Telehealth provided in patient's home
      service_lines: [
        {
          modifiers: [encounterParams.serviceLineModifier],
          procedure_code: procedureCode,
          quantity: "1",
          units: "UN",
          charge_amount_cents: costInCents,
          diagnosis_pointers: [0],
        },
      ],
      synchronicity: "Synchronous",
      clinical_notes: [
        {
          category: "chief_complaint",
          notes: [
            {
              author_name: `${provider.firstName} ${provider.lastName}`,
              text: "Obesity management",
              timestamp: dayjs.tz(timestamp, user.timezone).toISOString(),
              author_npi: provider.npi,
            },
          ],
        },
        {
          category: "procedure",
          notes: [
            {
              text: procedureCode,
              author_name: "System Generated Notes",
              timestamp: dayjs.tz(new Date(), user.timezone).toISOString(),
            },
          ],
        },
        ...(previousConditionsText
          ? [
              {
                category: "health_record",
                notes: [
                  {
                    author_name: `${provider.firstName} ${provider.lastName}`,
                    text: previousConditionsText,
                    timestamp: dayjs.tz(timestamp, user.timezone).toISOString(),
                    author_npi: provider.npi,
                  },
                ],
              },
            ]
          : []),
        ...(encounterParams.additionalClinicalNotes ?? []),
      ],
    }

    try {
      captureEvent("info", "Encoded encounter request", encounterRequest)

      // Candid API POST
      const { data } =
        await this.candidInstance.post<CandidEncodedEncounterResponse>(
          "/v1/coded_encounters",
          encounterRequest
        )

      // log results
      captureEvent(
        "info",
        "[CANDID] SUCCESSFULLY CREATED CODED ENCOUNTER",
        data
      )
      return data
    } catch (error) {
      const errorData = error.response?.data
      captureException(errorData)

      throw new CandidError(
        `Candid Create Coded Encounter Error: ${JSON.stringify(errorData)}`
      )
    }
  }

  /** Get answers from the medical (or any other) questionnaire. Returns an empty array if no tasks were found. */
  private async getConditions(
    user: User,
    /** Which answer key to retrieve answers from, e.g. "conditions" or "previousconditions". */
    questionnaire: string,
    /** If specified, uses this user task to retrieve answers instead of querying the database */
    userTask: UserTask = null,
    /** The task type. Defaults to `TaskType.NEW_PATIENT_INTAKE_FORM`. */
    taskType: TaskType = TaskType.NEW_PATIENT_INTAKE_FORM
  ): Promise<string[]> {
    const { userTasks } = userTask
      ? { userTasks: [userTask] }
      : await this.taskService.getUserTasks(user._id.toString(), {
          completed: true,
          taskType,
        })

    if (userTasks.length > 0) {
      const task = userTasks[0]
      const conditionsAnswer = task.answers?.find(
        (answer) => answer.key === questionnaire
      )
      if (conditionsAnswer) {
        const conditions = String(conditionsAnswer.value || "")
          .split(",")
          .map((s) => s.trim())
        return conditions
      }
    }

    return []
  }
}

function getSandboxObjects(
  fromUser: User,
  fromProvider: Provider,
  fromInsurance: InsuranceDetails
): {
  user: User
  provider: Provider
  insurance: InsuranceDetails
  cpid: string
} {
  const copyFields = (from: any, to: any) => {
    if (from) for (const key in from.toObject?.() || from) to[key] = from[key]
  }

  const user = new User()
  copyFields(fromUser, user)
  const provider = new Provider()
  copyFields(fromProvider, provider)
  const insurance = new InsuranceDetails()
  copyFields(fromInsurance, insurance)

  // use sandbox data for request
  user.name = "johnone doeone"
  user.dateOfBirth = new Date("1980-01-02")
  user.address.line1 = "123 address1"
  user.address.line2 = "123"
  user.address.city = "city1"
  user.address.state = "WA"
  user.address.postalCode = "981010000"
  user.phone = "123456789"
  user.email = "email@email.com"

  provider.npi = "0123456789"
  provider.firstName = "johnone"
  provider.lastName = "doeone"

  if (fromInsurance) {
    insurance.groupId = "0000000000"
    insurance.groupName = "group name"
    insurance.memberId = "0000000000"
    insurance.rxBIN = "123456"
    insurance.rxPCN = "abcdefg"
  }

  return { user, provider, insurance, cpid: "00007" }
}

import * as Sentry from "@sentry/node"
import axios, { AxiosInstance } from "axios"
import { ApolloError } from "apollo-server-errors"
import config from "config"
import { addSeconds, isPast } from "date-fns"
import type { LeanDocument } from "mongoose"
import type { IEAAppointment } from "../@types/easyAppointmentTypes"
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
} from "../@types/candidTypes"
import dayjs from "../utils/dayjs"
import {
  InsuranceEligibilityInput,
  User,
  UserModel,
} from "../schema/user.schema"
import { Provider } from "../schema/provider.schema"
import { TaskType } from "../schema/task.schema"
import { UserTask } from "../schema/task.user.schema"
import TaskService from "../services/task.service"
import lookupCPID from "../utils/lookupCPID"
import calculateSetting, { SettingsList } from "../utils/calculateSetting"
import { calculateBMI } from "../utils/calculateBMI"

export const authorizationTokenProvider = "candidhealth"

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
        Sentry.captureException(error.response?.data)
        console.log(
          `CandidService.authenticate error: ${JSON.stringify(
            error.response?.data
          )}`
        )
        throw error
      }
    }

    this.setAuthorizationBearer(token.token)

    return token
  }

  /** Gets an authorization token for candidhealth from the database, or null if none exists. */
  public async getSavedAuthorizationToken(): Promise<LeanDocument<AuthorizationToken> | null> {
    return (await AuthorizationTokenModel.findOne({
      provider: authorizationTokenProvider,
    }).lean()) as LeanDocument<AuthorizationToken>
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
      Sentry.captureException(error)
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
      Sentry.captureException(error.response?.data || error)
      console.log(
        `getEncounterForAppointment error: ${JSON.stringify(
          error.response?.data
        )}`
      )
      throw error
    }
  }

  /** Check insurance eligibility for the patient with the given insurance card information. */
  public async checkInsuranceEligibility(
    user: User,
    provider: Provider,
    input: InsuranceEligibilityInput,
    /** Optional. The CPID. Otherwise, uses fields from `input` to calculate. */
    cpid?: string
  ): Promise<{
    eligible: boolean
    reason?: string
    response: CandidEligibilityCheckResponse
  }> {
    await this.authenticate()

    const eligibleServiceTypeCode = config.get(
      "candidHealth.serviceTypeCode"
    ) as string

    try {
      const [userFirstName, userLastName] = user.name.split(" ")

      cpid = cpid || lookupCPID(input.payor, input.insuranceCompany)
      if (!cpid) {
        throw new Error("Could not infer CPID from payor.")
      }

      const request: CandidEligibilityCheckRequest = {
        tradingPartnerServiceId: cpid,
        provider: {
          firstName: provider.firstName,
          lastName: provider.lastName,
          npi: provider.npi,
          providerCode: "AD",
        },
        subscriber: {
          dateOfBirth: dayjs.utc(user.dateOfBirth).format("YYYYMMDD"),
          firstName: userFirstName?.trim() || "",
          lastName: userLastName?.trim() || "",
          gender: user.gender.toLowerCase().startsWith("m") ? "M" : "F",
          memberId: input.memberId,
        },
      }

      console.log(
        `Eligibility Request Param: ${JSON.stringify(request, null, "  ")}`
      )

      const { data } =
        await this.candidInstance.post<CandidEligibilityCheckResponse>(
          "/v0/eligibility",
          request
        )

      const hasInsurance = data.subscriber.insuredIndicator === "Y"
      const benefits = data.benefitsInformation.filter((item) =>
        item.serviceTypeCodes?.includes(eligibleServiceTypeCode)
      )
      const activeBenefits = benefits.filter((item) => item.code === "1")
      const inactiveBenefits = benefits.filter((item) => item.code !== "1")
      const ineligibleReasons = inactiveBenefits
        .map((item) => item.name)
        .filter((reason) => reason && reason.trim())

      const eligible = hasInsurance && activeBenefits.length > 0

      return {
        eligible,
        reason: eligible
          ? undefined
          : ineligibleReasons.length > 0
          ? ineligibleReasons.join(", ")
          : "Not Covered",
        response: data,
      }
    } catch (error) {
      console.log(
        "Candid eligibility request error",
        JSON.stringify(error.response?.data ?? error)
      )
      Sentry.captureException(error.response?.data ?? error)
      throw error
    }
  }

  /** Create a coded encounter. */
  async createCodedEncounterForAppointment(
    appointment: IEAAppointment,
    initialAppointment?: IEAAppointment
  ) {
    const user = await UserModel.findById(appointment.eaCustomer.id).populate<{
      provider: Provider
    }>("provider")

    if (!user)
      throw new ApolloError(
        `User ${appointment.eaCustomer.id} on appointment not found during insurance billing.`
      )

    const { provider } = user
    if (!provider)
      throw new ApolloError(`User ${user._id.toString()} has no provider.`)

    const input: InsuranceEligibilityInput = {
      ...user.insurance,
      userId: user._id.toString(),
      initialAppointmentId: initialAppointment?.eaAppointmentId ?? null,
    }

    return await this.createCodedEncounter(user, provider, appointment, input)
  }

  /**
   * Create a insurance billing request for an encounter (appointment).
   */
  async createCodedEncounter(
    user: User,
    provider: Provider,
    appointment: IEAAppointment,
    input: InsuranceEligibilityInput
  ) {
    await this.authenticate()

    const settings: SettingsList = config.get("candidHealth.settings")
    const {
      billingProvider,
    }: { billingProvider?: CandidRequestBillingProvider } = calculateSetting(
      settings,
      ["billingProvider"],
      { state: user.address.state.toUpperCase() }
    )

    const [userFirstName, userLastName] = user.name.split(" ")

    const userTasksResult = await this.taskService.getUserTasks(
      user._id.toString(),
      { taskType: TaskType.NEW_PATIENT_INTAKE_FORM }
    )

    const userIntake = userTasksResult.userTasks[0]

    const comorbidities = await this.getConditions(
      user,
      "conditions",
      userIntake
    )
    const disqualifiers = await this.getConditions(
      user,
      "previousConditions",
      userIntake
    )

    const latestWeight =
      Number(user.weights[user.weights.length - 1]?.value) ?? null

    const isInitialAppointment =
      !input.initialAppointmentId ||
      input.initialAppointmentId === appointment.eaAppointmentId

    if (disqualifiers.length > 0 && !isInitialAppointment) {
      Sentry.captureMessage(
        `createCodedEncounter: Patient ${
          user.name
        } [${user._id.toString()}] has the following disqualifiers: ${disqualifiers.join(
          ", "
        )}, and is being billed for a follow-up appointment.`
      )
    }

    // calculate BMI
    const bmi = calculateBMI(latestWeight, user.heightInInches)

    let procedureCode: string
    let costInCents: number
    const { diagnosis: diagnosisCode } = calculateSetting<{
      diagnosis: string
    }>(settings, ["diagnosis"], { bmi })

    if (isInitialAppointment) {
      const { procedure, cost } = calculateSetting(
        settings,
        ["procedure", "cost"],
        {
          bmi,
          comorbidities: comorbidities.length,
          initial:
            !input.initialAppointmentId ||
            input.initialAppointmentId === appointment.eaAppointmentId,
        }
      )
      procedureCode = procedure
      costInCents = cost
    } else {
      const initialEncounter = await this.getEncounterForAppointment(
        appointment,
        user
      )
      console.log("initial encounter", initialEncounter.external_id)
      const initialProcedureCode =
        initialEncounter.claims[0]?.service_lines[0]?.procedure_code
      const { followUpProcedure, followUpCost } = calculateSetting(
        settings,
        ["followUpProcedure", "followUpCost"],
        { initialProcedureCode }
      )

      procedureCode = followUpProcedure
      costInCents = followUpCost
    }

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

    const patientAddress: CandidAddressPlusFour = {
      address1: user.address.line1,
      address2: user.address.line2,
      city: user.address.city,
      state: user.address.state,
      zip_code: (user.address.postalCode || "").slice(0, 5),
      zip_plus_four_code: (user.address.postalCode || "").slice(5),
    }

    const encounterRequest: CandidCreateCodedEncounterRequest = {
      external_id: `${user._id.toString()}-${appointment.eaAppointmentId}`,
      date_of_service: dayjs
        .tz(appointment.start, appointment.timezone)
        .format("YYYY-MM-DD"),
      patient_authorized_release: true,
      benefits_assigned_to_provider: true,
      provider_accepts_assignment: true,
      appointment_type: "Obesity Management",
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
        patient_relationship_to_subscriber_code: "18", // Self (TODO)
        address: patientAddress,
        insurance_card: {
          member_id: input.memberId,
          payer_id: input.payor,
          payer_name: input.insuranceCompany,
          group_number: input.groupId,
          rx_bin: input.rxBin,
          rx_pcn: input.rxGroup,
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
      place_of_service_code: "10",
      service_lines: [
        {
          modifiers: ["95"], // 95 - Synchronous Telemedicine Service Rendered via a Real-Time Interactive Audio and Video Telecommunications System
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
              timestamp: dayjs
                .tz(appointment.end, appointment.timezone)
                .toISOString(),
              author_npi: provider.npi,
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
                    timestamp: dayjs
                      .tz(appointment.end, appointment.timezone)
                      .toISOString(),
                    author_npi: provider.npi,
                  },
                ],
              },
            ]
          : []),
      ],
    }

    try {
      const logRequest = `Encoded encounter request: ${JSON.stringify(
        encounterRequest
      )}`
      console.log(logRequest)
      Sentry.captureMessage(logRequest)
      const { data } =
        await this.candidInstance.post<CandidEncodedEncounterResponse>(
          "/v1/coded_encounters",
          encounterRequest
        )
      const logResponse = `Create encoded encounter result: ${JSON.stringify(
        data,
        null,
        "  "
      )}`
      console.log(logResponse)
      Sentry.captureMessage(logResponse)
      return data
    } catch (error) {
      const errorData = error.response?.data
      Sentry.captureException({
        message: "Candid Create Coded Encounter Error",
        errorData,
      })
      console.log(
        "Candid Create Coded Encounter Error",
        JSON.stringify(errorData)
      )

      throw new Error("Candid Create Coded Encounter Error")
    }
  }

  /** Get answers from the medical questionnaire. */
  private async getConditions(
    user: User,
    questionnaire: "conditions" | "previousConditions",
    userTask?: UserTask
  ): Promise<string[]> {
    const { userTasks } = userTask
      ? { userTasks: [userTask] }
      : await this.taskService.getUserTasks(user._id.toString(), {
          completed: true,
          taskType: TaskType.NEW_PATIENT_INTAKE_FORM,
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

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
import AppointmentService from "../services/appointment.service"
import lookupCPID from "../utils/lookupCPID"
import calculateSetting, { SettingsList } from "../utils/calculateSetting"
import { calculateBMI } from "../utils/calculateBMI"

export const authorizationTokenProvider = "candidhealth"

export class CandidError extends ApolloError {}

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

  constructor(private appointmentService: AppointmentService) {
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
        const logErrorMessage = `CandidService.authenticate error: ${JSON.stringify(
          error.response?.data
        )}`

        Sentry.captureEvent({
          message: logErrorMessage,
          level: "error",
        })
        console.log(logErrorMessage)
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
      const errorLogMessage = `CandidService.getEncounterForAppointment error: ${JSON.stringify(
        error.response?.data
      )}`
      Sentry.captureEvent({
        message: errorLogMessage,
        level: "error",
      })
      throw new CandidError(errorLogMessage)
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

    const eligibleServiceTypeCode: string = config.get(
      "candidHealth.serviceTypeCode"
    )

    try {
      const [userFirstName, userLastName] = user.name.split(" ")

      cpid = cpid || lookupCPID(input.payor, input.insuranceCompany)
      if (!cpid) {
        throw new CandidError(
          `Could not infer CPID from payor ${input.payor}/${input.insuranceCompany}.`
        )
      }

      if (process.env.NODE_ENV === "development") {
        // use sandbox data for request
        cpid = "00007"
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

        input.groupId = "0000000000"
        input.groupName = "group name"
        input.memberId = "0000000000"
        input.rxBin = "12345"
        input.rxGroup = "abcdefg"
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

      const requestLogMessage = `Candid Eligibility Request Object: ${JSON.stringify(
        request,
        null,
        "  "
      )}`
      console.log(requestLogMessage)
      Sentry.captureEvent({
        message: requestLogMessage,
        level: "info",
      })

      const { data } =
        await this.candidInstance.post<CandidEligibilityCheckResponse>(
          "/v0/eligibility",
          request
        )
      const responseLogMessage = `Candid Eligibility Response Object: ${JSON.stringify(
        data,
        null,
        "  "
      )}`
      console.log(responseLogMessage)
      Sentry.captureEvent({
        message: responseLogMessage,
        level: "info",
      })

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
      const errorLogMessage = `Candid eligibility request error: ${JSON.stringify(
        error.response?.data ?? error
      )}`
      Sentry.captureEvent({
        message: errorLogMessage,
        level: "error",
      })

      throw new CandidError(errorLogMessage)
    }
  }

  /** Create a coded encounter. */
  async createCodedEncounterForAppointment(appointment: IEAAppointment) {
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

    const initialAppointment =
      await this.appointmentService.getInitialAppointment(
        appointment.eaCustomer.id
      )
    const input: InsuranceEligibilityInput = {
      ...user.insurance,
      userId: user._id.toString(),
    }

    return await this.createCodedEncounter(
      user,
      provider,
      appointment,
      input,
      initialAppointment
    )
  }

  /**
   * Create a insurance billing request for a coded encounter (from appointment).
   */
  async createCodedEncounter(
    user: User,
    provider: Provider,
    appointment: IEAAppointment,
    input: InsuranceEligibilityInput,
    initialAppointment?: IEAAppointment
  ) {
    await this.authenticate()

    // calculate the billing provider for the claim
    const settings: SettingsList = config.get("candidHealth.settings")
    const {
      billingProvider,
    }: { billingProvider?: CandidRequestBillingProvider } = calculateSetting(
      settings,
      ["billingProvider"],
      { state: user.address.state.toUpperCase() }
    )

    const billingLogMessage = `Candid selected billing provider for state ${
      user.address.state
    }: ${JSON.stringify(billingProvider)}`
    console.log(billingLogMessage)
    Sentry.captureEvent({
      message: billingLogMessage,
      level: "info",
    })

    const userTasksResult = await this.taskService.getUserTasks(
      user._id.toString(),
      { taskType: TaskType.NEW_PATIENT_INTAKE_FORM, completed: true, limit: 1 }
    )

    const userIntake = userTasksResult.userTasks[0]

    const comorbidities = await this.getConditions(
      user,
      "conditions",
      userIntake
    )

    const latestWeight =
      Number(user.weights[user.weights.length - 1]?.value) ?? null

    const isInitialAppointment =
      !initialAppointment ||
      initialAppointment.eaAppointmentId === appointment.eaAppointmentId

    // calculate BMI
    const bmi = calculateBMI(latestWeight, user.heightInInches)

    // if a follow-up appointment, retrieve the initial claim to find the procedure code.
    const initialEncounter = isInitialAppointment
      ? null
      : await this.getEncounterForAppointment(initialAppointment, user)

    const initialProcedureCode: string | undefined =
      initialEncounter?.clinical_notes
        ?.find((note) => note.category === "procedure")
        ?.notes[0]?.trim() ?? null

    const calculationCriteria = {
      bmi,
      comorbidities: comorbidities.length,
      initial: isInitialAppointment,
      initialProcedureCode,
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
      const logMessage = `Candid Create Coded Encounter Error: No procedure code or cost matches the following criteria: ${JSON.stringify(
        calculationCriteria
      )}.`
      Sentry.captureEvent({ level: "warning", message: logMessage })
      throw new CandidError(logMessage)
    } else {
      const criteriaLog = `Procedure code ${procedureCode}, diagnosis code ${diagnosisCode} and cost ${costInCents} calculated from ${JSON.stringify(
        calculationCriteria
      )}.`
      console.log(criteriaLog)
      Sentry.captureEvent({
        message: criteriaLog,
        level: "info",
      })
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
        patient_relationship_to_subscriber_code: "18", // Self
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
        {
          category: "procedure",
          notes: [
            {
              text: procedureCode,
              author_name: "System Generated Notes",
              timestamp: dayjs
                .tz(new Date(), appointment.timezone)
                .toISOString(),
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
      Sentry.captureMessage(logRequest)

      // Candid API POST
      const { data } =
        await this.candidInstance.post<CandidEncodedEncounterResponse>(
          "/v1/coded_encounters",
          encounterRequest
        )

      // log results
      const logResponse = `Create encoded encounter result: ${JSON.stringify(
        data
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

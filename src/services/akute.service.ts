import { ApolloError } from "apollo-server"
import axios, { AxiosInstance } from "axios"
import { Buffer } from "buffer"
import config from "config"
import { format } from "date-fns"
import FormData from "form-data"
import {
  AkuteDocument,
  CreateLabOrderResponse,
  DocUploadInput,
  PharmacyLocationInput,
} from "../schema/akute.schema"
import {
  CreatePatientInput,
  UserModel,
  Insurance,
  User,
} from "../schema/user.schema"
import { calculateBMI } from "../utils/calculateBMI"
import { Provider } from "../schema/provider.schema"
import calculateSetting, { SettingsList } from "../utils/calculateSetting"
import { captureEvent, captureException } from "../utils/sentry"
import EmailService from "./email.service"

export interface AkuteCreateInsuranceRequest {
  patient_id: string
  member_id: string
  group_id: string
  group_name: string
  rx_bin: string
  rx_group: string
  payor: string
  status: string
  order: number
}

/** Response from a POST to /insurance */
export interface AkuteInsuranceResponse {
  rx_id: string
  medical_id: string
}

export interface AkuteProcedureResponse {
  system: string
  code: string
  display: string
}

export interface AkuteOrderResponse {
  id: string
  request_id: string
  procedures: { id: string; name: string }[]
  ordering_user_id: string
  authoring_user_id: string
  date_ordered: string
  patient_id: string
  external_patient_id: string
  status: string | "active"
  performer_organization_id: string
  performer_organization_name: string
  delivery_option: string
  account_number: string
  billing_type: string
  document_id: string
  lab_reference_id: string
}

export interface AkuteOrderRequest {
  patient_id: string
  procedures: { system: string; code: string; display: string }[]
  billing_type: string
  delivery_option: string
  ordering_user_id: string
  performer_organization_id: string
  account_number: string
  diagnoses: string[]
}

export interface AkuteDocumentResponse {
  id: string
  file_name: string
  patient_id: string
  external_patient_id: string
  last_updated: string
  created_at: string
  tags: string[]
  url: string
}

export interface AkutePatientResponse {
  id: string
}

class AkuteService {
  private baseUrl: string
  public axios: AxiosInstance
  private emailService: EmailService

  constructor() {
    this.baseUrl = config.get("akuteApiUrl")
    this.axios = axios.create({
      baseURL: this.baseUrl,
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": process.env.AKUTE_API_KEY,
      },
    })
    this.emailService = new EmailService()
  }

  async getPatient(patientId: string): Promise<AkutePatientResponse> {
    try {
      const { data } = await this.axios.get<AkutePatientResponse>(
        `/patients/${patientId}`
      )
      return data
    } catch (e) {
      const error = new ApolloError(e.message ?? e, "ERROR")
      captureException(error, "AkuteService.getDocument error", {
        patientId,
        message: error.message ?? null,
      })
      throw error
    }
  }

  async createPatient(input: CreatePatientInput) {
    input.email = input.email.toLowerCase()

    const {
      firstName: first_name,
      lastName: last_name,
      email,
      phone: primary_phone_number,
      address: {
        line1: address_line_1,
        line2: address_line_2,
        city: address_city,
        state: address_state,
        postalCode: address_zipcode,
      },
      sex,
      dateOfBirth,
    } = input

    const parsedPhone = primary_phone_number
      .replace("+1", "")
      .replace("+0", "")
      .replace("+", "")
      .replace(/-/g, "")
      .replace(" ", "")
      .replace(")", "")
      .replace("(", "")

    try {
      const { status, data: patientData } = await this.axios.get(
        `/patients?email=${email}`
      )
      if (status === 200) {
        return patientData[0].id
      }

      const { data } = await this.axios.post("/patients", {
        first_name,
        last_name,
        status: "active",
        date_of_birth: format(dateOfBirth, "yyyy-MM-dd"),
        sex: sex.toLowerCase(),
        address_line_1,
        ...(address_line_2 && { address_line_2 }),
        address_city,
        address_state,
        address_zipcode: address_zipcode.slice(0, 5),
        email,
        primary_phone_number: parsedPhone,
        primary_phone_type: "mobile",
        appointment_state: address_state,
      })

      return data.data.id
    } catch (error) {
      captureException(error, "AkuteService.createPatient error", { input })
      throw new ApolloError(
        error.message ?? "Error creating akute patient.",
        "ERROR"
      )
    }
  }

  async convertAddressToLatLng(
    addressLine1: string,
    addressCity: string,
    addressState: string,
    addressZipCode: string
  ): Promise<{ lat: number; lng: number }> {
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${addressLine1},${addressCity},${addressState},${addressZipCode}&key=${process.env.GOOGLE_API_KEY}`
      const response = await axios.get(url)
      // If geometry is not found, return 0,0
      if (!response.data?.results[0]?.geometry) {
        return { lat: 0, lng: 0 }
      } else {
        return {
          lat: response.data?.results[0]?.geometry?.location?.lat,
          lng: response.data?.results[0]?.geometry.location.lng,
        }
      }
    } catch (error) {
      captureException(error, "AkuteServe.convertAddressToLatLng error", {
        addressLine1,
        addressCity,
        addressState,
        addressZipCode,
      })

      throw new ApolloError(
        error.message ?? "Error converting address to geocoordinates.",
        "ERROR"
      )
    }
  }

  async getPharmacyLocations(input: PharmacyLocationInput, userId: string) {
    let user: User
    try {
      user = await UserModel.findById(userId)
      if (!user) {
        throw new ApolloError("User not found", "NOT_FOUND")
      }
      const params: { name?: string; zip: string } = {
        zip: user.address.postalCode,
      }
      if (input.name) {
        params.name = input.name
      }
      const data = await this.axios.get("/pharmacy", { params })

      const pharmacyLocations = await Promise.all(
        data.data.map(async (pharmacy: any) => {
          const { lat, lng } = (await this.convertAddressToLatLng(
            pharmacy.address_line_1,
            pharmacy.address_city,
            pharmacy.address_state,
            pharmacy.address_zipcode
          )) || { lat: 0, lng: 0 }
          return { ...pharmacy, lat, lng }
        })
      )
      return pharmacyLocations
    } catch (error) {
      captureException(error, "AkuteService.getPharmacyLocations error", {
        input,
        zip: user?.address?.postalCode,
      })
      throw new ApolloError(
        error.message ?? "Error retrieving pharmacy locations.",
        "ERROR"
      )
    }
  }

  async createPharmacyListForPatient(
    pharmacyId: string,
    patientId: string,
    isPrimary: boolean
  ) {
    try {
      const { data } = await this.axios.post("/pharmacy", {
        pharmacy_id: pharmacyId,
        patient_id: patientId,
        set_as_primary: isPrimary,
      })
      return data
    } catch (error) {
      captureException(
        error,
        "Akuteservice.createPharmacyListForPatient error",
        {
          patientId,
          function: "createPharmacyListForPatient",
          isPrimary,
        }
      )

      throw new ApolloError(
        error.message ?? "Error creating pharmacy list for patient.",
        "ERROR"
      )
    }
  }

  async getPatientMedications() {
    try {
      // get all patients from akute by calling /patients?status=active
      // get all medications for each patient by calling /medications?patient_id=patient_id
      // Only show patients with medications where the generic_name = "tirzepatide"

      const { data: patients } = await this.axios.get("/patients?status=active")
      const patientMedications = await Promise.all(
        patients.map(async (patient: any) => {
          const { data: medications } = await this.axios.get(
            `/medications?patient_id=${patient.id}`
          )
          return {
            patient,
            medications: medications.filter(
              (medication: any) => medication.generic_name === "tirzepatide"
            ),
          }
        })
      )
      return patientMedications
    } catch (error) {
      captureException(error, "AkuteService.getPatientMedications error", {
        function: "AkuteService.getPatientMedications",
      })

      throw new ApolloError(
        error.message ?? "Error retrieving patient medications.",
        "ERROR"
      )
    }
  }
  async getASinglePatientMedications(patientId: string) {
    try {
      const { data: medications } = await this.axios.get(
        `/medications?patient_id=${patientId}`
      )
      return medications
    } catch (error) {
      captureException(
        error,
        "AkuteService.getASinglePatientMedications error",
        {
          function: "getASinglePatientMedications",
          patientId,
        }
      )

      throw new ApolloError(
        error.message ?? "Error retrieving medications for patient.",
        "ERROR"
      )
    }
  }

  /**
   * Retrieves an akute lab order by ID.
   * @see https://documenter.getpostman.com/view/4139535/2s93XzyP7n#40eb95b9-d856-43ce-94be-f9272ef12564
   */
  async getLabOrder(labOrderId: string) {
    try {
      const { data } = await this.axios.get<AkuteOrderResponse>(
        `/orders/${labOrderId}`
      )
      return data
    } catch (error) {
      captureException(error, "AkuteService.getLabOrder error", { labOrderId })
      throw new ApolloError(
        error.message ?? "Error creating lab order.",
        "ERROR"
      )
    }
  }

  async getUsers() {
    const { data } = await this.axios.get("/users")
    return data
  }

  /** Search for procedures by partial match string. */
  async searchProcedures(query: string): Promise<AkuteProcedureResponse[]> {
    const labCorpOrganizationId: string = config.get(
      "akute.labCorpOrganizationId"
    )

    try {
      const { data } = await this.axios.get<AkuteProcedureResponse[]>(
        "/procedures",
        {
          params: {
            performer_organization_id: labCorpOrganizationId,
            query,
          },
        }
      )

      return data
    } catch (error) {
      captureException(error, "AkuteService.searchProcedures error", {
        query,
        labCorpOrganizationId,
      })
      throw new ApolloError("Error searching lab procedures.", "ERROR")
    }
  }

  async createLabOrder(userId: string): Promise<CreateLabOrderResponse> {
    const labCorpAccountNumber: string = config.get(
      "akute.labCorpAccountNumber"
    )
    const labCorpOrganizationId: string = config.get(
      "akute.labCorpOrganizationId"
    )
    const procedures: AkuteProcedureResponse[] = config.get("akute.procedures")

    let createLabOrderRequest: AkuteOrderRequest
    try {
      const user = await UserModel.findById(userId).populate<{
        provider: Provider
      }>("provider")
      if (!user) {
        throw new ApolloError("User not found", "NOT_FOUND")
      }

      const { provider } = user

      const providerAkuteId =
        process.env.NODE_ENV === "production"
          ? provider?.akuteId
          : "63be0bb0999a7f4e76f1159d" // staging provider from Akute
      // : "61f460492a15afd4d476aa58"

      if (!providerAkuteId) {
        throw new ApolloError("Provider not found.", "NOT_FOUND")
      }

      const bmi = calculateBMI(user.weights[0].value, user.heightInInches)

      const { diagnosis: icdCode } = calculateSetting<{ diagnosis: string }>(
        config.get("candidHealth.settings") as SettingsList,
        ["diagnosis"],
        { bmi }
      )

      if (!icdCode) {
        throw new ApolloError("Invalid diagnosis code.", "ERROR")
      }

      createLabOrderRequest = {
        patient_id: user.akutePatientId,
        ordering_user_id: providerAkuteId,
        performer_organization_id: labCorpOrganizationId,
        account_number: labCorpAccountNumber,
        procedures,
        billing_type: "patient",
        delivery_option: "electronic",
        diagnoses: [icdCode],
      }

      const { data } = await this.axios.post("/orders", createLabOrderRequest)

      if (!data.id) {
        captureException(
          data,
          `Lab order not created for user id: ${user._id}`,
          { data, createLabOrderRequest }
        )
        throw new ApolloError("Lab order not created", "ERROR")
      }

      const order = await this.getLabOrder(data.id)

      captureEvent(
        "info",
        `Lab order created: ${data.id} for user id: ${user._id}`,
        {
          tags: {
            userId,
            function: "AkuteService.createLabOrder",
            createLabOrderRequest,
            order,
          },
        }
      )

      await UserModel.findByIdAndUpdate(userId, {
        labOrderSent: true,
      })

      const document = await this.getDocument(order.document_id)
      captureEvent(
        "info",
        `Retrieved document ${order.document_id} for lab order ${order.id}`,
        {
          document,
          orderId: order.id,
        }
      )

      await this.emailService.sendLabOrderAttachmentEmail(
        user.email,
        document.url
      )

      return { labOrderId: data.id }
    } catch (error) {
      captureException(error, "AkuteService.createLabOrder error", {
        userId,
        function: "createLabOrder",
        createLabOrderRequest,
      })
      throw new ApolloError(
        error.message ?? "AkuteService.createLabOrderError",
        "ERROR"
      )
    }
  }

  /**
   * Retrieves a document from Akute.
   * @see https://documenter.getpostman.com/view/4139535/2s93XzyP7n#c5ae5dfb-75b3-4283-9d08-19a2433dfa43
   */
  async getDocument(documentId: string): Promise<AkuteDocumentResponse> {
    try {
      const { data } = await this.axios.get<AkuteDocumentResponse>(
        `/documents/${documentId}`
      )
      return data
    } catch (e) {
      const error = new ApolloError(e.message ?? e, "ERROR")
      captureException(error, "AkuteService.getDocument error", {
        documentId,
      })
      throw error
    }
  }

  async uploadDocument({
    file,
    fileName,
    description = "",
    externalPatientId,
    patientId,
    tags = [],
  }: DocUploadInput): Promise<AkuteDocument> {
    try {
      if (!file) {
        throw new ApolloError("Required file not found", "NOT_FOUND")
      }

      const formData = new FormData()
      const fileBuffer = Buffer.from(file, "base64")
      formData.append("file", fileBuffer, fileName)
      formData.append("file_name", fileName)

      if (patientId) {
        formData.append("patient_id", patientId)
      } else if (externalPatientId) {
        formData.append("external_patient_id", externalPatientId)
      } else {
        throw new ApolloError("Patient identifier not found", "NOT_FOUND")
      }

      if (description) {
        formData.append("description", description)
      }
      if (tags?.length > 0) {
        tags.forEach((tag) => formData.append("tags[]", tag))
      }

      const { data } = await this.axios.post("/documents", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
          "X-API-Key": process.env.AKUTE_API_KEY,
        },
      })

      return { id: data?.id }
    } catch (error) {
      captureException(error, "AkuteService.uploadDocument error", {
        function: "AkuteService.uploadDocument",
        patientId,
        externalPatientId,
        fileName,
        tags,
        description,
      })

      throw new ApolloError(
        error.message ?? "Error uploading akute document.",
        "ERROR"
      )
    }
  }

  async createInsurance(
    akuteId: string,
    input: Insurance
  ): Promise<AkuteInsuranceResponse> {
    try {
      const createInsuranceRequest: AkuteCreateInsuranceRequest = {
        patient_id: akuteId,
        member_id: input.memberId,
        group_id: input.groupId,
        group_name: input.groupName,
        rx_bin: input.rxBin,
        rx_group: input.rxGroup,
        payor: input.payor,
        status: "active",
        order: 1,
      }
      const { data } = await this.axios.post<AkuteInsuranceResponse>(
        "/insurance",
        createInsuranceRequest
      )

      captureEvent("info", "AkuteService.createInsurance result", data)
      return data
    } catch (error) {
      captureException(error, "AkuteService.createInsurance error", {
        akuteId,
        input,
      })
      throw new ApolloError(
        error.message ?? "Error creating insurance for patient.",
        "ERROR"
      )
    }
  }
}

export default AkuteService

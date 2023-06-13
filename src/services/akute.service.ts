import * as Sentry from "@sentry/node"
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
import { CreatePatientInput, UserModel } from "../schema/user.schema"

class AkuteService {
  public baseUrl: string
  public axios: AxiosInstance

  constructor() {
    this.baseUrl = config.get("akuteApiUrl")
    this.axios = axios.create({
      baseURL: this.baseUrl,
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": process.env.AKUTE_API_KEY,
      },
    })

    console.log(process.env.AKUTE_API_KEY)
  }

  async createPatient(input: CreatePatientInput) {
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
        address_zipcode: address_zipcode.includes("-")
          ? address_zipcode.split("-")[0]
          : address_zipcode,
        email,
        primary_phone_number: parsedPhone,
        primary_phone_type: "mobile",
        appointment_state: address_state,
      })

      return data.data.id
    } catch (error) {
      console.log(error)
      Sentry.captureException(error)
      throw new ApolloError(error.message, "ERROR")
    }
  }

  async convertAddressToLatLng(
    addressLine1: string,
    addressCity: string,
    addressState: string,
    addressZipCode: string
  ): Promise<{ lat: number, lng: number }> {
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
      Sentry.captureException(error)
      throw new ApolloError(error.message, "ERROR")
    }
  }

  async getPharmacyLocations(input: PharmacyLocationInput, userId: string) {
    try {
      const user = await UserModel.findById(userId)
      if (!user) {
        throw new ApolloError("User not found", "NOT_FOUND")
      }
      const data = await this.axios.get(
        `/pharmacy?name=${input.name}&zip=${user.address.postalCode}`
      )
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
      Sentry.captureException(error)
      throw new ApolloError(error.message, "ERROR")
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
    } catch (e) {
      Sentry.captureException(new Error(e), {
        tags: {
          patientId,
          function: "createPharmacyListForPatient",
        },
      })

      throw new ApolloError(e.message, "ERROR")
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
    } catch (e) {
      Sentry.captureException(new Error(e), {
        tags: {
          function: "getPatientMedications",
        },
      })

      throw new ApolloError(e.message, "ERROR")
    }
  }
  async getASinglePatientMedications(patientId: string) {
    try {
      const { data: medications } = await this.axios.get(
        `/medications?patient_id=${patientId}`
      )
      return medications
    } catch (e) {
      Sentry.captureException(new Error(e), {
        tags: {
          function: "getASinglePatientMedications",
        },
      })

      throw new ApolloError(e.message, "ERROR")
    }
  }
  async createLabOrder(userId: string): Promise<CreateLabOrderResponse> {
    const labCorpAccountNumber = config.get("akute.labCorpAccountNumber") as any
    const labCorpOrganizationId = config.get(
      "akute.labCorpOrganizationId"
    ) as any

    try {
      const user = await UserModel.findById(userId).populate("provider")
      if (!user) {
        throw new ApolloError("User not found", "NOT_FOUND")
      }

      const provider = user.provider as any

      const providerAkuteId =
        process.env.NODE_ENV === "production"
          ? provider?.akuteId
          : "63be0bb0999a7f4e76f1159d" // staging provider from Akute

      if (!providerAkuteId) {
        throw new ApolloError("Provider not found", "NOT_FOUND")
      }

      const bmi =
        (user.weights[0].value / user.heightInInches / user.heightInInches) *
        703.071720346

      const icdCode = 27 < bmi && bmi < 30 ? "E66.3" : "E66.9"

      const { data } = await this.axios.post("/orders", {
        patient_id: user.akutePatientId,
        procedures: [
          {
            system: "urn:uuid:f:e20f61500ba128d340068ff6",
            code: "322000",
            display: "Comp. Metabolic Panel (14)",
          },
          {
            system: "urn:uuid:f:e20f61500ba128d340068ff6",
            code: "001453",
            display: "Hemoglobin A1c",
          },
          {
            system: "urn:uuid:f:e20f61500ba128d340068ff6",
            code: "303756",
            display: "Lipid Panel",
          },
          {
            system: "urn:uuid:f:e20f61500ba128d340068ff6",
            code: "004259",
            display: "TSH",
          },
          {
            system: "urn:uuid:f:e20f61500ba128d340068ff6",
            code: "120766",
            display: "C-Reactive Protein, Cardiac",
          },
          {
            system: "urn:uuid:f:e20f61500ba128d340068ff6",
            code: "081950",
            display: "Vitamin D, 25-Hydroxy",
          },
          {
            system: "urn:uuid:f:e20f61500ba128d340068ff6",
            code: "004333",
            display: "Insulin",
          },
        ],
        billing_type: "patient",
        delivery_option: "electronic",
        ordering_user_id: providerAkuteId,
        performer_organization_id: labCorpOrganizationId,
        account_number: labCorpAccountNumber,
        diagnoses: [...icdCode],
      })

      console.log(data)
      Sentry.captureMessage(
        `Lab order created: ${data.id} for user id: ${user._id}`,
        {
          tags: {
            userId,
            function: "createLabOrder",
          },
        }
      )

      if (!data.id) {
        console.log("Lab order not created", JSON.stringify(data))
        throw new ApolloError("Lab order not created", "ERROR")
      }

      await UserModel.findByIdAndUpdate(userId, {
        labOrderSent: true,
      })

      return {
        labOrderId: data.id,
      }
    } catch (e) {
      console.log(e)
      Sentry.captureException(new Error(e), {
        tags: {
          userId,
          function: "createLabOrder",
        },
      })

      throw new ApolloError(e.message, "ERROR")
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
      console.log(error.response.data)

      Sentry.captureException(error, {
        tags: {
          function: "uploadDocument",
        },
      })

      throw new ApolloError(error.message, "ERROR")
    }
  }
}

export default AkuteService

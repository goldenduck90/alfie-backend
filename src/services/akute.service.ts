import * as Sentry from "@sentry/node"
import { ApolloError } from "apollo-server"
import axios, { AxiosInstance } from "axios"
import config from "config"
import { format } from "date-fns"
import { PharmacyLocationInput } from "../schema/akute.schema"
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

    try {
      const { status, data: patientData } = await this.axios.get(
        `/patients?email=${email}`
      )
      if (status === 200) {
        console.log(patientData[0].id)
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
        primary_phone_number: primary_phone_number.replace("+1", ""),
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
      if (!response.data?.results[0].geometry) {
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
}

export default AkuteService

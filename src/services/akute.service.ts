import axios, { AxiosInstance } from "axios"
import config from "config"
import { format } from "date-fns"
import { CreatePatientInput } from "../schema/user.schema"

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
      console.log({
        first_name,
        last_name,
        status: "active",
        date_of_birth: format(dateOfBirth, "yyyy-MM-dd"),
        sex: sex.toLowerCase(),
        address_line_1,
        address_line_2,
        address_city,
        address_state,
        address_zipcode,
        email,
        primary_phone_number,
        primary_phone_type: "mobile",
      })

      const { data } = await this.axios.post("/patients", {
        first_name,
        last_name,
        status: "active",
        date_of_birth: format(dateOfBirth, "yyyy-MM-dd"),
        sex: sex.toLowerCase(),
        address_line_1,
        address_line_2,
        address_city,
        address_state,
        address_zipcode,
        email,
        primary_phone_number,
        primary_phone_type: "mobile",
      })

      console.log(data)

      return data.id
    } catch (error) {
      console.log(error)
    }
  }
}

export default AkuteService

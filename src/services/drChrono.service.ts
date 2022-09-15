import axios from "axios"
import { AuthorizationTokenModel } from "../schema/authorizationToken.schema"
import qs from "qs"
import { UserModel } from "../schema/user.schema"

const drChronoInstance = axios.create({
  baseURL: "https://drchrono.com",
})

// Request interceptor for API calls
drChronoInstance.interceptors.request.use(
  async (config) => {
    const authToken = await AuthorizationTokenModel.findOne({
      provider: "drchrono",
    })

    config.headers = {
      "Authorization": `Bearer ${authToken?.token}`,
      "Accept": "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    }
    return config
  },
  (error) => {
    Promise.reject(error)
  }
)

// Response interceptor for API calls
drChronoInstance.interceptors.response.use(
  (response) => {
    return response
  },
  async (error) => {
    const originalRequest = error.config
    if (error.response.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true
      const access_token = await refreshDrChronoToken()
      axios.defaults.headers.common["Authorization"] = "Bearer " + access_token
      return drChronoInstance(originalRequest)
    }
    return Promise.reject(error)
  }
)

enum LabDocumentType {
  REQ = "REQ", // requisition form
  ABN = "ABN", // ABN (Advance Beneficiary Notice)
  RA = "R-A", // requisition form and :abbr:ABN (Advance Beneficiary Notice)
  RES = "RES", // lab result
}
interface ILabDocument {
  document: string
  lab_order: number
  type: LabDocumentType
}
enum LabResultType {
  P = "P", // Preliminary
  I = "I", // Pending
  C = "C", // Correction
  F = "F", // Final
  X = "X", // Cancelled
}
interface ILabResult {
  document: number // ID of /lab_documents object for the result
  lab_test: number // ID of /lab_tests object for the result
  status: LabResultType
  test_performed: string
  value: string
}
interface DrChronoUser {
  _id: string
  first_name: string
  last_name: string
  gender: string
  date_of_birth: string
  email: string
  doctor: number
}
async function refreshDrChronoToken() {
  try {
    const authToken = await AuthorizationTokenModel.findOne({
      provider: "drchrono",
    })
    console.log("authToken", authToken)
    const { data } = await drChronoInstance.post(
      "/o/token/",
      qs.stringify({
        refresh_token: authToken?.refreshToken,
        grant_type: "refresh_token",
        client_id: process.env.DRCHRONO_CLIENT_ID,
        client_secret: process.env.DRCHRONO_CLIENT_SECRET,
      }),
      {
        headers: {
          "content-type": "application/x-www-form-urlencoded",
        },
      }
    )
    const filter = { provider: "drchrono" }
    const update = {
      token: data.access_token,
    }
    const updatedToken = await AuthorizationTokenModel.findOneAndUpdate(
      filter,
      update
    )
    console.log("updatedToken", updatedToken)
    return updatedToken
  } catch (error) {
    console.log(error)
  }
}
async function createDrChronoUser({
  _id,
  first_name,
  last_name,
  gender,
  date_of_birth,
  email,
  doctor,
}: DrChronoUser) {
  try {
    const authToken = await AuthorizationTokenModel.findOne({
      provider: "drchrono",
    })
    console.log({
      _id,
      first_name,
      last_name,
      gender,
      date_of_birth,
      email,
      doctor,
    })
    const { data } = await drChronoInstance.post(
      "/api/patients",
      {
        first_name,
        last_name,
        gender,
        date_of_birth,
        email,
        doctor,
      },
      {
        headers: {
          "Authorization": `Bearer ${authToken?.token}`,
          "Content-Type": "application/json",
        },
      }
    )
    console.log(data, "data")
    const user = await UserModel.findById(_id)
    const updatedUser = await UserModel.findByIdAndUpdate(user?._id, {
      drchronoId: data.id,
      // eaPractitionerId: data.doctor,
    })
    //TODO Lookup all the doctors associated to where the patient is located by state, we need to assign the patient to the doctor with the least amount of patients assigned to them. filter by practitioner
    // TODO: Also store the doctor ID in the patient record
    // TODO: Add the eaPractitionerId to the patient record
    // TODO: Store drchrono user id in our database on the user
    console.log("data", data)
    return data
  } catch (error) {
    console.log("error", error.response)
  }
}
async function getDrChronoUser(id: string) {
  try {
    const authToken = await AuthorizationTokenModel.findOne({
      provider: "drchrono",
    })
    const { data } = await drChronoInstance.get(`/api/patients/${id}`, {
      headers: {
        Authorization: `Bearer ${authToken?.token}`,
      },
    })
    return data
  } catch (error) {
    console.log(error)
  }
}
async function createDrChronoSubLab({ name, facility_code, vendor_name }: any) {
  try {
    const authToken = await AuthorizationTokenModel.findOne({
      provider: "drchrono",
    })
    const { data } = await drChronoInstance.post(
      "/api/sublabs",
      {
        name,
        facility_code,
        vendor_name,
      },
      {
        headers: {
          Authorization: `Bearer ${authToken?.token}`,
        },
      }
    )
    return data
  } catch (error) {
    console.log(error)
  }
}
async function createDrChronoLabOrder({ doctor, patient, sublab }: any) {
  try {
    const authToken = await AuthorizationTokenModel.findOne({
      provider: "drchrono",
    })
    const { data } = await drChronoInstance.post(
      "/api/lab_orders",
      {
        doctor,
        patient,
        sublab,
      },
      {
        headers: {
          Authorization: `Bearer ${authToken?.token}`,
        },
      }
    )
    return data
  } catch (error) {
    console.log(error)
  }
}
async function createDrChronoLabDocument({
  document,
  lab_order,
  type,
}: ILabDocument) {
  try {
    const authToken = await AuthorizationTokenModel.findOne({
      provider: "drchrono",
    })
    const { data } = await drChronoInstance.post(
      "/api/lab_documents",
      {
        document,
        lab_order,
        type,
      },
      {
        headers: {
          Authorization: `Bearer ${authToken?.token}`,
        },
      }
    )
    return data
  } catch (error) {
    console.log(error)
  }
}
async function createDrChronoLabResults({
  document,
  lab_test,
  status,
  test_performed,
  value,
}: ILabResult) {
  try {
    const authToken = await AuthorizationTokenModel.findOne({
      provider: "drchrono",
    })
    const { data } = await drChronoInstance.post(
      "/api/lab_results",
      {
        document,
        lab_test,
        status,
        test_performed,
        value,
      },
      {
        headers: {
          Authorization: `Bearer ${authToken?.token}`,
        },
      }
    )
    return data
  } catch (error) {
    console.log(error)
  }
}
async function getAllDrChronoDoctors() {
  try {
    const authToken = await AuthorizationTokenModel.findOne({
      provider: "drchrono",
    })
    const { data } = await drChronoInstance.get("/api/doctors", {
      headers: {
        Authorization: `Bearer ${authToken?.token}`,
      },
    })
    return data
  } catch (error) {
    console.log(error)
  }
}
// New Endpoint
// Create example CSV for Alex and Rohit
// Take in a CSV with drChrono doctor ID and states and patients to doctor, and eaPractitionerId, add another field called type for "practitioner" or "doctor"
// Upload the CSV to MongoDB Collection the collection name should be providers

export {
  refreshDrChronoToken,
  createDrChronoUser,
  getDrChronoUser,
  createDrChronoSubLab,
  createDrChronoLabOrder,
  createDrChronoLabDocument,
  createDrChronoLabResults,
  getAllDrChronoDoctors,
}

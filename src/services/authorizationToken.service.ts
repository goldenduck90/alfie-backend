import axios from "axios"
import { AuthorizationTokenModel } from "../schema/authorizationToken.schema"
import qs from "qs"

const drChronoInstance = axios.create({
  baseURL: "https://drchrono.com",
})
enum LabDocumentType {
  REQ = "REQ", // requisition form
  ABN = "ABN", // ABN (Advance Beneficiary Notice)
  RA = "R-A", // requisition form and :abbr:ABN (Advance Beneficiary Notice)
  RES = "RES", // lab results
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
      refreshToken: data.refresh_token,
    }
    const updatedToken = await AuthorizationTokenModel.findOneAndUpdate(
      filter,
      update
    )
    return updatedToken
  } catch (error) {
    console.log(error)
  }
}
async function createDrChronoUser({
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
    const { data } = await drChronoInstance.post(
      "/api/users",
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
          Authorization: `Bearer ${authToken?.token}`,
        },
      }
    )
    return data
  } catch (error) {
    if (error.response.message === "Authorization failed.") {
      await refreshDrChronoToken()
      const data: any = await createDrChronoUser({
        first_name,
        last_name,
        gender,
        date_of_birth,
        email,
        doctor,
      }) // TODO TYPE responses from DrChrono
      return data
    }
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
    if (error.response.message === "Authorization failed.") {
      await refreshDrChronoToken()
      const data: any = await getDrChronoUser(id) // TODO TYPE responses from DrChrono
      return data
    }
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
    if (error.response.message === "Authorization failed.") {
      await refreshDrChronoToken()
      const data: any = await createDrChronoSubLab({
        name,
        facility_code,
        vendor_name,
      }) // TODO TYPE responses from DrChrono
      return data
    }
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
    if (error.response.message === "Authorization failed.") {
      await refreshDrChronoToken()
      const data: any = await createDrChronoLabOrder({
        doctor,
        patient,
        sublab,
      }) // TODO TYPE responses from DrChrono
      return data
    }
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
    if (error.response.message === "Authorization failed.") {
      await refreshDrChronoToken()
      const data: any = await createDrChronoLabDocument({
        document,
        lab_order,
        type,
      }) // TODO TYPE responses from DrChrono
      return data
    }
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
    if (error.response.message === "Authorization failed.") {
      await refreshDrChronoToken()
      const data: any = await createDrChronoLabResults({
        document,
        lab_test,
        status,
        test_performed,
        value,
      }) // TODO TYPE responses from DrChrono
      return data
    }
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
    if (error.response.message === "Authorization failed.") {
      await refreshDrChronoToken()
      const data: any = await getAllDrChronoDoctors() // TODO TYPE responses from DrChrono
      return data
    }
  }
}
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

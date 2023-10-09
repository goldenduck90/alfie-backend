import { ApolloError } from "apollo-server"
import { MetriportDevicesApi } from "@metriport/api"
import { UserModel } from "../schema/user.schema"
import { MetriportConnectResponse } from "../schema/metriport.schema"

export interface MetriportUser {
  userId: string
  providers?: string[]
  body?: {
    weight_samples_kg?: {
      time: Date
      value: number
      date_source: {
        id?: string | null
        name?: string | null
        type?: string | null
        source_type?: string | null
      }
    }[]
  }[]
}
class MetriportService {
  private client: MetriportDevicesApi

  constructor() {
    const sandbox = process.env.NODE_ENV !== "production"
    this.client = new MetriportDevicesApi(process.env.METRIPORT_API_KEY, {
      sandbox,
    })
  }

  async createConnectToken(userId: string): Promise<MetriportConnectResponse> {
    try {
      let metriportUserId
      const user = await UserModel.findById(userId)
      metriportUserId = user.metriportUserId

      if (!metriportUserId) {
        metriportUserId = await this.client.getMetriportUserId(userId)
        await UserModel.findByIdAndUpdate(userId, {
          metriportUserId,
        })
      }
      const token = await this.client.getConnectToken(metriportUserId)

      const url = new URL("https://connect.metriport.com/")
      url.searchParams.append("token", token)
      url.searchParams.append("providers", "withings")
      if (process.env.NODE_ENV !== "production")
        url.searchParams.append("sandbox", "true")

      return {
        url: url.href,
      }
    } catch (err) {
      throw new ApolloError(err.message, "ERROR")
    }
  }
}

export default MetriportService

import { SDK } from "@ringcentral/sdk"
import { addSeconds, differenceInSeconds, isPast } from "date-fns"
import FormData from "form-data"
import config from "config"
import { AuthorizationTokenModel } from "../schema/authorizationToken.schema"
import * as Sentry from "@sentry/node"
class FaxService {
  private sdk: SDK

  constructor() {
    const clientId = config.get("ringCentral.clientId") as any
    this.sdk = new SDK({
      server:
        process.env.NODE_ENV === "production"
          ? SDK.server.production
          : SDK.server.sandbox,
      clientId,
      clientSecret: process.env.RINGCENTRAL_CLIENT_SECRET,
    })
  }

  calculateExpiresAt(expiresInSeconds: number) {
    return addSeconds(new Date(), expiresInSeconds - 60) // 60 seconds before expiration to be safe
  }

  calculateExpiresIn(expiresAt: Date) {
    const expiresInSeconds = differenceInSeconds(expiresAt, new Date())
    const expiresIn = expiresInSeconds > 0 ? `${expiresInSeconds}` : "0"
    return expiresIn
  }

  async handleAuth() {
    const { number, extension } = config.get("ringCentral") as any
    const auth = await AuthorizationTokenModel.findOne().where({
      provider: "ringcentral",
    })
    if (!auth) {
      // if no auth, login and save auth
      const resp = await this.sdk.login({
        username: number,
        password: process.env.RINGCENTRAL_PASSWORD,
        extension,
      })
      const data = await resp.json()

      const expiresAt = this.calculateExpiresAt(data.expires_in)
      const refreshTokenExpiresAt = this.calculateExpiresAt(
        data.refresh_token_expires_in
      )

      const newAuth = await AuthorizationTokenModel.create({
        token: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt,
        refreshTokenExpiresAt,
        provider: "ringcentral",
      })

      return newAuth
    }

    // if refresh token is expired, login and save auth
    if (isPast(auth.refreshTokenExpiresAt)) {
      const resp = await this.sdk.login({
        username: number,
        password: process.env.RINGCENTRAL_PASSWORD,
        extension,
      })
      const data = await resp.json()

      const expiresAt = this.calculateExpiresAt(data.expires_in)
      const refreshTokenExpiresAt = this.calculateExpiresAt(
        data.refresh_token_expires_in
      )

      auth.token = data.access_token
      auth.refreshToken = data.refresh_token
      auth.expiresAt = expiresAt
      auth.refreshTokenExpiresAt = refreshTokenExpiresAt
      await auth.save()

      return auth
    }

    // set auth data to sdk
    this.sdk
      .platform()
      .auth()
      .setData({
        access_token: auth.token,
        refresh_token: auth.refreshToken,
        expires_in: this.calculateExpiresIn(auth.expiresAt),
        refresh_token_expires_in: this.calculateExpiresIn(
          auth.refreshTokenExpiresAt
        ),
      })

    // if access token is expired, refresh and save auth
    if (isPast(auth.expiresAt)) {
      const newAuth = await this.sdk.platform().refresh()
      const data = await newAuth.json()

      auth.token = data.access_token
      auth.refreshToken = data.refresh_token
      auth.expiresAt = this.calculateExpiresAt(data.expires_in)
      await auth.save()

      return auth
    }

    return auth
  }

  async sendFax({
    faxNumber,
    pdfBuffer,
  }: {
    faxNumber: string
    pdfBuffer: Uint8Array
  }) {
    try {
      // handle auth before sending fax
      await this.handleAuth()

      const body = {
        to: [{ phoneNumber: faxNumber }], // see all available options on Developer Portal
        faxResolution: "High",
        coverIndex: 0,
      }

      const formData = new FormData()

      // This is the mandatory part, the name and type should always be as follows
      formData.append("json", Buffer.from(JSON.stringify(body)), {
        contentType: "application/json",
        filename: "request.json",
      })

      formData.append("attachment", Buffer.from(pdfBuffer), {
        contentType: "application/pdf",
        filename: "attachment.pdf",
      })

      const resp = await this.sdk.post(
        "/restapi/v1.0/account/~/extension/~/fax",
        formData
      )
      const data = await resp.json()

      return data
    } catch (err) {
      console.error(err)
      Sentry.captureException(err)
      throw err
      // TODO: handle error
    }
  }
}

export default FaxService

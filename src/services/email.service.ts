import * as AWS from "aws-sdk"
import config from "config"

const AWS_SES = new AWS.SES({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
})

class EmailService {
  async sendForgotPasswordEmail({
    email,
    token,
  }: {
    email: string
    token: string
  }) {
    const baseUrl = config.get("baseUrl")
    const path = config.get("paths.forgotPassword")
    const url = `${baseUrl}/${path}/${token}`

    console.log(email, token)
    const params = {
      Source: "no-reply@joinalfie.com",
      Destination: {
        ToAddresses: [email],
      },
      ReplyToAddresses: [] as string[],
      Message: {
        Body: {
          Html: {
            Charset: "UTF-8",
            Data: url,
          },
        },
        Subject: {
          Charset: "UTF-8",
          Data: url,
        },
      },
    }

    const result = await AWS_SES.sendEmail(params).promise()
    return result.MessageId
  }

  async sendRegistrationEmail({
    email,
    token,
  }: {
    email: string
    token: string
  }) {
    // send email via sns
    console.log(email, token)
    return true
  }
}

export default EmailService

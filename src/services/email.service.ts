import * as AWS from "aws-sdk"
import config from "config"

class EmailService {
  noReplyEmail: string
  baseUrl: string
  awsSes: AWS.SES

  constructor() {
    this.noReplyEmail = config.get("noReplyEmail")
    this.baseUrl = config.get("baseUrl")
    this.awsSes = new AWS.SES({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION,
    })
  }

  async sendForgotPasswordEmail({
    email,
    token,
  }: {
    email: string
    token: string
  }) {
    const { path, subject } = config.get("emails.forgotPassword")
    const url = `${this.baseUrl}/${path}/${token}`

    const params = {
      Source: this.noReplyEmail,
      Destination: {
        ToAddresses: [email],
      },
      ReplyToAddresses: [] as string[],
      Message: {
        Body: {
          Html: {
            Charset: "UTF-8",
            Data: url, // TODO: build email template & copy
          },
        },
        Subject: {
          Charset: "UTF-8",
          Data: subject,
        },
      },
    }

    const result = await this.awsSes.sendEmail(params).promise()
    return result.MessageId
  }

  async sendRegistrationEmail({
    email,
    token,
    manual = false,
  }: {
    email: string
    token: string
    manual?: boolean
  }) {
    const { path, subject } = config.get("emails.completeRegistration")
    const url = `${this.baseUrl}/${path}/${token}`

    // TODO: change email content based on manual flag
    console.log(manual)

    const params = {
      Source: this.noReplyEmail,
      Destination: {
        ToAddresses: [email],
      },
      ReplyToAddresses: [] as string[],
      Message: {
        Body: {
          Html: {
            Charset: "UTF-8",
            Data: url, // TODO: build email template & copy
          },
        },
        Subject: {
          Charset: "UTF-8",
          Data: subject,
        },
      },
    }

    const result = await this.awsSes.sendEmail(params).promise()
    return result.MessageId
  }
}

export default EmailService

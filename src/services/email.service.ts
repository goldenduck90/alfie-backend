import * as AWS from "aws-sdk"
import config from "config"
import { format } from "date-fns"

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
    const { path, subject } = config.get("emails.forgotPassword") as any
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
  async sendRegistrationEmailTemplate({
    email,
    token,
    manual = false,
    name,
  }: {
    email: string
    token: string
    manual?: boolean
    name: string
  }) {
    const { path } = config.get("emails.completeRegistration") as any
    const url = `${this.baseUrl}/${path}/${token}`
    console.log(manual)
    const params = {
      Destination: {
        ToAddresses: [email],
      },
      Template: "patient-tasks",
      TemplateData: JSON.stringify({
        url: url,
        name: name,
      }),
      Source: "patients@joinalfie.com",
    }
    const result = await this.awsSes.sendTemplatedEmail(params).promise()
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
    const { path, subject } = config.get("emails.completeRegistration") as any
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

  async sendTaskAssignedEmail({
    email,
    taskName,
    taskType,
    taskId,
    dueAt,
  }: {
    email: string
    taskName: string
    taskId: string
    taskType: string
    dueAt?: Date
  }) {
    const { path, subject } = config.get("emails.taskAssigned") as any
    const url = `${this.baseUrl}/${path}/${taskType}/${taskId}`

    const emailBody = `
      Hello,<br/><br/>
      
      You have been assigned a task: ${taskName}.<br/>
      ${
        dueAt
          ? `It is due on ${format(dueAt, "MM/dd/yyyy @ h:mm a")}.<br/><br/>`
          : "<br/>"
      }

      Please click the link below to complete the task:<br/>
      ${url}<br/><br/>

      Thanks,<br/>
      Alfie Team
    `

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
            Data: emailBody, // TODO: build email template & copy
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

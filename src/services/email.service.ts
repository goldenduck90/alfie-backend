import * as Sentry from "@sentry/node"
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
    provider = false,
  }: {
    email: string
    token: string
    provider?: boolean
  }) {
    const { path, subject } = config.get("emails.forgotPassword") as any
    const url = `${this.baseUrl}/${path}?token=${token}&provider=${provider}`

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
    provider = false,
  }: {
    email: string
    token: string
    manual?: boolean
    name: string
    provider?: boolean
  }) {
    try {
      const { path } = config.get("emails.completeRegistration") as any
      const url = `${this.baseUrl}/${path}?${token}&provider=${provider}`
      console.log(
        {
          email,
          token,
          manual,
          name,
        },
        "logs"
      )
      const params = {
        Destination: {
          ToAddresses: [email],
        },
        Template: "signup",
        TemplateData: JSON.stringify({
          url: url,
          name: name,
        }),
        Source: "patients@joinalfie.com",
      }
      const result = await this.awsSes.sendTemplatedEmail(params).promise()
      return result.MessageId
    } catch (error) {
      Sentry.captureException(error)
      console.log(error)
    }
  }

  async sendRegistrationEmail({
    email,
    token,
    provider = false,
    manual = false,
  }: {
    email: string
    token: string
    provider?: boolean
    manual?: boolean
  }) {
    const { path, subject } = config.get("emails.completeRegistration") as any
    const url = `${this.baseUrl}/${path}?${token}&provider=${provider}`

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

  async sendAppointmentCreatedEmail({
    name,
    email,
    start,
    end,
    date,
    id,
    otherName,
    provider = false,
  }: {
    name: string
    email: string
    start: string
    end: string
    date: string
    id: string
    otherName: string
    provider?: boolean
  }) {
    const url = `${this.baseUrl}/dashboard/appointments/${id}`

    const emailBody = `
      Hello ${name},<br/><br/>
      
      An appointment with ${
        provider ? "patient," : ""
      } <b>${otherName}</b> has been scheduled.<br/><br/>

      <b>Appointment Date:</b> ${date}<br/>
      <b>Start Time:</b> ${start}<br/>
      <b>End Time:</b> ${end}<br/><br/>

      Please click the link below to view the appointment details:<br/>
      ${url}<br/><br/>

      If you have any questions, please reach out to your Alfie care team<br/><br/>

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
          Data: `Appointment with ${
            provider ? "patient," : ""
          } ${otherName} scheduled`,
        },
      },
    }

    const result = await this.awsSes.sendEmail(params).promise()
    return result.MessageId
  }

  async sendAppointmentUpdatedEmail({
    name,
    email,
    start,
    end,
    date,
    id,
    otherName,
    provider = false,
  }: {
    name: string
    email: string
    start: string
    end: string
    date: string
    id: string
    otherName: string
    provider?: boolean
  }) {
    const url = `${this.baseUrl}/dashboard/appointments/${id}`

    const emailBody = `
      Hello ${name},<br/><br/>
      
      You're appointment with ${
        provider ? "patient, " : ""
      } <b>${otherName}</b> has been rescheduled.<br/><br/>

      <b>Appointment Date:</b> ${date}<br/>
      <b>Start Time:</b> ${start}<br/>
      <b>End Time:</b> ${end}<br/><br/>

      Please click the link below to view the appointment details:<br/>
      ${url}<br/><br/>

      If you have any questions, please reach out to your Alfie care team<br/><br/>

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
          Data: `Appointment with ${
            provider ? "patient," : ""
          } ${otherName} scheduled`,
        },
      },
    }

    const result = await this.awsSes.sendEmail(params).promise()
    return result.MessageId
  }

  async sendAppointmentCancelledEmail({
    name,
    email,
    start,
    end,
    date,
    otherName,
    provider = false,
  }: {
    name: string
    email: string
    start: string
    end: string
    date: string
    otherName: string
    provider?: boolean
  }) {
    const emailBody = `
      Hello ${name},<br/><br/>
      
      Your appointment with ${
        provider ? "patient," : ""
      } <b>${otherName}</b> has been cancelled.<br/><br/>

      <b>Appointment Date:</b> ${date}<br/>
      <b>Start Time:</b> ${start}<br/>
      <b>End Time:</b> ${end}<br/><br/>

      If you have any questions, please reach out to your Alfie care team<br/><br/>

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
          Data: `Appointment with ${
            provider ? "patient," : ""
          } ${otherName} cancelled`,
        },
      },
    }

    const result = await this.awsSes.sendEmail(params).promise()
    return result.MessageId
  }
}

export default EmailService

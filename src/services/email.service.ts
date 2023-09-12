import * as Sentry from "@sentry/node"
import * as AWS from "aws-sdk"
import config from "config"
import { format } from "date-fns"
import axios from "axios"
import { createTransport } from "nodemailer"
import dayjs from "../utils/dayjs"
import { AllTaskEmail, TaskEmail } from "../schema/task.schema"
import { captureEvent, captureException } from "../utils/sentry"
import S3Service from "./s3.service"

export default class EmailService {
  noReplyEmail: string
  awsSes: AWS.SES
  s3Service: S3Service

  constructor() {
    this.s3Service = new S3Service()
    this.noReplyEmail = config.get("noReplyEmail")
    this.awsSes = new AWS.SES({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION,
    })
  }

  async sendEmail(
    subject: string,
    body: string,
    toEmails: string[],
    replyTo?: string
  ) {
    captureEvent("info", "EmailService.sendEmail", {
      email: {
        subject,
        body,
        toEmails,
        replyTo,
      },
    })

    const params: AWS.SES.SendEmailRequest = {
      Source: replyTo ?? this.noReplyEmail,
      Destination: {
        ToAddresses: toEmails,
      },
      ReplyToAddresses: [] as string[],
      Message: {
        Body: {
          Html: {
            Charset: "UTF-8",
            Data: body,
          },
        },
        Subject: {
          Charset: "UTF-8",
          Data: subject,
        },
      },
    }

    const result = await this.awsSes.sendEmail(params).promise()
    return result
  }

  async sendEmailWithAttachment(
    subject: string,
    body: string,
    toEmails: string[],
    /** The URL of a publicly-accessible file. */
    attachmentUrl: string,
    /** The content type of the file (e.g. application/pdf). */
    contentType: string,
    replyTo?: string
  ): Promise<AWS.SES.SendEmailResponse> {
    try {
      const file = await axios.get(attachmentUrl, {
        responseType: "arraybuffer",
      })
      const content = Buffer.from(file.data).toString("base64")

      const transporter = createTransport({ SES: this.awsSes })
      const result = await transporter.sendMail({
        from: replyTo ?? this.noReplyEmail,
        to: toEmails,
        subject,
        html: body,
        attachments: [
          {
            filename: `Lab Order ${dayjs().format("YYYY-MM-DD")}.pdf`,
            content,
            contentType,
            encoding: "base64",
          },
        ],
      })

      return { MessageId: result.messageId }
    } catch (error) {
      captureException(error, "EmailService.sendEmailWithAttachment", {
        subject,
        toEmails,
        attachmentUrl,
        contentType,
      })
      throw error
    }
  }

  async sendForgotPasswordEmail({
    email,
    token,
  }: {
    email: string
    token: string
  }) {
    const { path, subject } = config.get("emails.forgotPassword") as any
    const baseUrl = config.get("baseUrl") as any
    const url = `${baseUrl}/${path}?token=${token}`

    const result = await this.sendEmail(subject, url, [email])
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
      const baseUrl = config.get("baseUrl") as any
      const url = `${baseUrl}/${path}?registration=true&token=${token}&patient=${!provider}`
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
    const baseUrl = config.get("baseUrl") as any
    const url = `${baseUrl}/${path}?registration=true&token=${token}&patient=${!provider}`

    // TODO: change email content based on manual flag
    console.log(manual)

    const result = await this.sendEmail(subject, url, [email])
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
    const baseUrl = config.get("baseUrl") as any
    const url = `${baseUrl}/${path}/${taskType}/${taskId}`

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

    const result = await this.sendEmail(subject, emailBody, [email])

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
    const baseUrl = config.get("baseUrl") as any
    const url = `${baseUrl}/dashboard/appointments/${id}`

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

    const subject = `Appointment with ${
      provider ? "patient," : ""
    } ${otherName} scheduled`

    const result = await this.sendEmail(subject, emailBody, [email])

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
    const baseUrl = config.get("baseUrl") as any
    const url = `${baseUrl}/dashboard/appointments/${id}`

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

    const subject = `Appointment with ${
      provider ? "patient," : ""
    } ${otherName} scheduled`

    const result = await this.sendEmail(subject, emailBody, [email])

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

    const subject = `Appointment with ${
      provider ? "patient," : ""
    } ${otherName} cancelled`

    const result = await this.sendEmail(subject, emailBody, [email])

    return result.MessageId
  }

  async sendTaskReport({
    allNewTasks = [],
    allPastDueTasks = [],
    allDueTodayTasks = [],
    errors = [],
  }: {
    allNewTasks?: AllTaskEmail[]
    allPastDueTasks?: AllTaskEmail[]
    allDueTodayTasks?: AllTaskEmail[]
    errors?: string[]
  }) {
    const emailBody = `
      Hello,<br/><br/>

      ${
        allNewTasks.length > 0
          ? "The following users had new tasks assigned to them: <br/><br/>"
          : ""
      }
      ${
        allNewTasks.length > 0
          ? `
        <table style="border: 1px solid #000000;">
          <tr>
            <th>Task Name</th>
            <th>Due At</th>
            <th>User ID</th>
            <th>User Email</th>
          </tr>
      `
          : ""
      }
      ${allNewTasks.map(
        (n: AllTaskEmail) => `
        <tr>
          <td><a href="">${n.taskName}</a></td>
          <td>${n.dueAtFormatted}</td>
          <td>${n.userId}</td>
          <td>${n.userEmail}</td>
        </tr>
      `
      )}
      ${allNewTasks.length > 0 ? "</table><br/><br/>" : ""}

      ${
        allDueTodayTasks.length > 0
          ? "The following users have been notified of tasks due today: <br/><br/>"
          : ""
      }
      ${
        allDueTodayTasks.length > 0
          ? `
        <table style="border: 1px solid #000000;">
          <tr>
            <th>Task Name</th>
            <th>Due At</th>
            <th>User ID</th>
            <th>User Email</th>
          </tr>
      `
          : ""
      }
      ${allDueTodayTasks.map(
        (n: AllTaskEmail) => `
        <tr>
          <td>${n.taskName}</td>
          <td>${n.dueAtFormatted}</td>
          <td>${n.userId}</td>
          <td>${n.userEmail}</td>
        </tr>
      `
      )}
      ${allDueTodayTasks.length > 0 ? "</table><br/><br/>" : ""}

      ${
        allPastDueTasks.length > 0
          ? "The following users have been notified of tasks that are past due: <br/><br/>"
          : ""
      }
      ${
        allPastDueTasks.length > 0
          ? `
        <table style="border: 1px solid #000000;">
          <tr>
            <th>Task Name</th>
            <th>Due At</th>
            <th>User ID</th>
            <th>User Email</th>
          </tr>
      `
          : ""
      }
      ${allPastDueTasks.map(
        (n: AllTaskEmail) => `
        <tr>
          <td>${n.taskName}</td>
          <td>${n.dueAtFormatted}</td>
          <td>${n.userId}</td>
          <td>${n.userEmail}</td>
        </tr>
      `
      )}
      ${allPastDueTasks.length > 0 ? "</table><br/><br/>" : ""}

      ${errors.length > 0 ? "The following errors occured: <br/><br/>" : ""}
      ${
        errors.length > 0
          ? `
        <table style="border: 1px solid #000000;">
          <tr>
            <th>Error</th>
          </tr>
      `
          : ""
      }
      ${errors.map(
        (e) => `
        <tr>
          <td>${e}</td>
        </tr>
      `
      )}
      ${errors.length > 0 ? "</table><br/><br/>" : ""}

      Thanks,<br/>
      Alfie Team
    `

    const result = await this.sendEmail("Daily Task Report", emailBody, [
      "robert@joinalfie.com",
      "alexander@joinalfie.com",
      "rohit@joinalfie.com",
      "patients@joinalfie.com",
    ])

    return result.MessageId
  }

  async sendTaskEmail({
    name,
    email,
    newTasks = [],
    pastDueTasks = [],
    dueTodayTasks = [],
  }: {
    name: string
    email: string
    newTasks?: TaskEmail[]
    pastDueTasks?: TaskEmail[]
    dueTodayTasks?: TaskEmail[]
  }) {
    const emailBody = `
      Hello ${name},<br/><br/>

      ${
        newTasks.length > 0
          ? "You have been assigned the following new tasks: <br/><br/>"
          : ""
      }
      ${
        newTasks.length > 0
          ? `
        <table style="border: 1px solid #000000;">
          <tr>
            <th>Task Name</th>
            <th>Due At</th>
          </tr>
      `
          : ""
      }
      ${newTasks.map(
        (n: TaskEmail) => `
        <tr>
          <td>${n.taskName}</td>
          <td>${n.dueAtFormatted}</td>
        </tr>
      `
      )}
      ${newTasks.length > 0 ? "</table><br/><br/>" : ""}

      ${
        dueTodayTasks.length > 0
          ? "You have the following tasks that are due today: <br/><br/>"
          : ""
      }
      ${
        dueTodayTasks.length > 0
          ? `
        <table style="border: 1px solid #000000;">
          <tr>
            <th>Task Name</th>
            <th>Due At</th>
          </tr>
      `
          : ""
      }
      ${dueTodayTasks.map(
        (n: TaskEmail) => `
        <tr>
          <td>${n.taskName}</td>
          <td>${n.dueAtFormatted}</td>
        </tr>
      `
      )}
      ${dueTodayTasks.length > 0 ? "</table><br/><br/>" : ""}

      ${
        pastDueTasks.length > 0
          ? "You have the following tasks that are past due: <br/><br/>"
          : ""
      }
      ${
        pastDueTasks.length > 0
          ? `
        <table style="border: 1px solid #000000;">
          <tr>
            <th>Task Name</th>
            <th>Due At</th>
          </tr>
      `
          : ""
      }
      ${pastDueTasks.map(
        (n: TaskEmail) => `
        <tr>
          <td>${n.taskName}</td>
          <td>${n.dueAtFormatted}</td>
        </tr>
      `
      )}
      ${pastDueTasks.length > 0 ? "</table><br/><br/>" : ""}

      <a href="https://app.joinalfie.com">Click here</a> to go to the Patient Portal.<br/><br/>
      
      If you have any questions, please reach out to your Alfie care team<br/><br/>

      Thanks,<br/>
      Alfie Team
    `

    const result = await this.sendEmail(
      "You have tasks to complete with Alfie",
      emailBody,
      [email]
    )

    return result.MessageId
  }

  async sendAppointmentPatientSkippedEmail({
    eaAppointmentId,
    name,
    providerName,
    email,
    date,
    time,
  }: {
    eaAppointmentId: string
    name: string
    providerName: string
    email: string
    date: string
    time: string
  }) {
    const baseUrl = config.get("baseUrl") as string
    const url = `${baseUrl}/dashboard/appointments/${eaAppointmentId}`
    const emailBody = `
      Hello ${name},<br/><br/>
      
      It looks like we missed you at your virtual appointment on ${date} at ${time} with ${providerName}.
      Don't worry, it's not an issue!
      <br /><br />
      You can reschedule <a href="${url}">here</a>. In the future, if you know you won't be able to make an appointment,
      try and let us know 24 hours in advance. Have a wonderful rest of your day!
      <br />br />

      Sincerely,<br />
      Your Alfie Care Team
    `

    const result = await this.sendEmail("Missed Alfie Appointment", emailBody, [
      email,
    ])

    return result.MessageId
  }

  async sendAppointmentProviderSkippedEmail({
    eaAppointmentId,
    name,
    patientName,
    email,
    date,
    time,
  }: {
    eaAppointmentId: string
    name: string
    patientName: string
    email: string
    date: string
    time: string
  }) {
    const baseUrl = config.get("baseUrl") as string
    const url = `${baseUrl}/dashboard/appointments/${eaAppointmentId}`

    const emailBody = `
      Hello ${name},<br /><br />
      You missed your appointment with ${patientName} on ${date} at ${time}.<br /><br />
      You can reschedule <a href="${url}">here</a>.

      Thanks,<br />
      Your Alfie Care Team
    `

    const result = await this.sendEmail(
      "Missed Alfie Patient Appointment",
      emailBody,
      [email]
    )

    return result.MessageId
  }

  async sendEligibilityCheckResultEmail({
    patientName,
    patientEmail,
    patientPhone,
    eligible,
    reason,
  }: {
    patientEmail: string
    patientName: string
    patientPhone: string
    eligible: boolean
    reason?: string
  }) {
    /**
     * Send email to patients@joinalfie.com
     */
    const subject = `${patientName} ${
      eligible ? "Eligible" : "Ineligible"
    } for Insurance`
    const emailBody = `
    <b>Patient Name:</b> ${patientName}<br/>
    <b>Patient Email:</b> ${patientEmail}<br/>
    <b>Patient Phone:</b> ${patientPhone}<br/>
    <b>Eligibility Status:</b> ${eligible ? "Approved" : "Denied"}<br/>
    ${!eligible ? `<b>Reason:</b> ${reason}<br/>` : ""}
    `

    const providerEmailResult = await this.sendEmail(subject, emailBody, [
      "patients@joinalfie.com",
    ])

    /**
     * Send email to patient's email
     */
    const patientSubject = `Your eligibility results have come in${
      eligible ? "!" : "."
    }`
    const patientEmailBody = eligible
      ? `
      ${patientName},
      <br /><br />
      Based on the information you provided, your insurance covers visits with your Alfie provider.
      Please make sure to login to <a href="https://app.joinalfie.com" target="_blank">app.joinalfie.com</a>
      and complete your current tasks. Once complete, you'll receive a new task to schedule with the provider!
    `
      : `
      <p>Hi ${patientName},</p>
      <p>It seems like the insurance information you gave us is not being accepted, but don't worry! It could be because:</p>

      <ol>
        <li>The insurance information you entered was incorrect or had a typo</li>
        <li>Your insurance doesn't have coverage for services given by Alfie</li>
      </ol>

      <p>
        If you think there was a typo or error, please tell us by replying to this email with your full insurance information
        again, or with that of a spouse whose insurance you may be under. If you think you did enter it correctly and we do
        not serve your insurance, you can still continue with Alfie via cash pay at $120 a month.
      </p>

      <p>
        At this moment, you have 48 hours to respond with a valid insurance card, or we will assume you are okay with cash pay.
        Please let us know if otherwise.
      </p>

      <p>Have a wonderful rest of your day!</p>

      <p>
        Sincerely,<br />
        Your Alfie Care Team
      </p>
    `

    console.log(
      `Log only: email to patient: ${JSON.stringify({
        patientSubject,
        patientEmailBody,
        patientEmail,
      })}`
    )

    // TODO: re-enable when eligibility checks are consistent
    // const patientEmailResult = await this.sendEmail(
    //   patientSubject,
    //   patientEmailBody,
    //   [patientEmail]
    // )

    return {
      providerEmailId: providerEmailResult.MessageId,
      patientEmailId: "", // patientEmailResult.MessageId,
    }
  }

  async sendLabOrderAttachmentEmail(email: string, labOrderUrl: string) {
    const subject = "Alfie Health Lab Order"
    const toEmails = [email]
    const message = "<p>Your Alfie Health Lab Order is attached.</p>"

    return await this.sendEmailWithAttachment(
      subject,
      message,
      toEmails,
      labOrderUrl,
      "application/pdf"
    )
  }
}

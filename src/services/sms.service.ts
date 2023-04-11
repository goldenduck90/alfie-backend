import config from "config"
import { TaskEmail } from "../schema/task.schema"
import client, { Twilio } from "twilio"
import { utcToZonedTime } from "date-fns-tz"

export class SmsService {
  client: Twilio
  from: string

  constructor() {
    const accountSid = config.get("twilioAccountSid") as any
    this.client = client(accountSid, process.env.TWILIO_AUTH_TOKEN)
    this.from = "+18447440088"
  }

  async sendTaskSms({
    name,
    phone,
    newTasks = [],
    pastDueTasks = [],
    dueTodayTasks = [],
    timezone,
  }: {
    name: string
    phone: string
    newTasks?: TaskEmail[]
    pastDueTasks?: TaskEmail[]
    dueTodayTasks?: TaskEmail[]
    timezone?: string
  }) {
    const body = `
      Hey ${name},\n\n

      You have the following new task notifications:\n
      ${
        newTasks.length > 0
          ? `- ${newTasks.length} new ${
              newTasks.length > 1 ? "tasks are" : "task is"
            } ready to complete.\n`
          : ""
      }
      ${
        dueTodayTasks.length > 0
          ? `- ${dueTodayTasks.length} ${
              dueTodayTasks.length > 1 ? "tasks are" : "task is"
            } due today.\n`
          : ""
      }
      ${
        pastDueTasks.length > 0
          ? `- ${pastDueTasks.length} ${
              pastDueTasks.length > 1 ? "tasks are" : "task is"
            } past due.\n`
          : ""
      }

      \nAlfie Team
    `

    const message = await this.client.messages.create({
      body,
      to: phone,
      from: this.from,
      sendAt: timezone
        ? utcToZonedTime(new Date().setHours(17, 0, 0), timezone)
        : new Date(new Date().setHours(17, 0, 0)),
    })

    return message
  }
}

export default SmsService

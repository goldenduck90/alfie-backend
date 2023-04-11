import config from "config"
import { TaskEmail } from "../schema/task.schema"
import client, { Twilio } from "twilio"
import { utcToZonedTime } from "date-fns-tz"
import { addDays, isPast } from "date-fns"

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
    const messageSid = config.get("twilioMessagingServiceSid") as any

    let body = `Hey ${name},\n\n`
    body += "You have the following new task notifications:\n"
    if (newTasks.length > 0) {
      body += `- ${newTasks.length} new ${
        newTasks.length > 1 ? "tasks are" : "task is"
      } ready to complete.\n`
    }

    if (dueTodayTasks.length > 0) {
      body += `- ${dueTodayTasks.length} ${
        dueTodayTasks.length > 1 ? "tasks are" : "task is"
      } due today.\n`
    }

    if (pastDueTasks.length > 0) {
      body += `- ${pastDueTasks.length} ${
        pastDueTasks.length > 1 ? "tasks are" : "task is"
      } past due.\n`
    }

    body += "\nAlfie Team"

    const date = isPast(new Date().setHours(17, 0, 0))
      ? addDays(new Date().setHours(17, 0, 0), 1)
      : new Date().setHours(17, 0, 0)

    const message = await this.client.messages.create({
      body,
      to: phone,
      from: this.from,
      messagingServiceSid: messageSid,
      scheduleType: "fixed",
      sendAt: utcToZonedTime(date, timezone),
    })

    return message
  }
}

export default SmsService

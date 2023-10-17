import { connectToMongo } from "../src/utils/mongo"
import { UserModel } from "../src/schema/user.schema"
import { UserTaskModel } from "../src/schema/task.user.schema"
import {
  getMessagesInChannel,
  getSendBirdUserChannels,
} from "../src/utils/sendBird"
import { createObjectCsvWriter } from "csv-writer"

type Action = {
  customer_id: string
  action_taken: string
  timestamp: Date
}

async function getPatientActionList() {
  try {
    const patients = await UserModel.find({
      $or: [
        { subscriptionExpiresAt: { $gte: new Date() } },
        { subscriptionExpiresAt: null },
        { subscriptionExpiresAt: { $exists: false } },
      ],
    })
    const userTasks = await UserTaskModel.find({
      $in: { user: patients.map((u) => u.id) },
    })
    const actions: Action[] = []

    for (const patient of patients) {
      const patientUserTasks = userTasks.filter(
        (t) => String(t.user) == String(patient._id)
      )

      // logins
      const noTypePatient = patient as any
      const logins = generateLogins(patient._id, noTypePatient.createdAt)
      actions.push(...logins)

      // tasks
      const taskActions: Action[] = patientUserTasks.map((t) => ({
        customer_id: String(t.user),
        action_taken: "TASK_COMPLETION",
        timestamp: t.completedAt || t.createdAt,
      }))
      actions.push(...taskActions)

      // sendbird
      const messageActions = await getMessageActions(patient._id)
      actions.push(...messageActions)
    }

    // Export a report
    if (actions.length > 0) {
      const csvWriter = createObjectCsvWriter({
        path: `${Date.now()}-active-patient-action-list.csv`,
        header: [
          { id: "customer_id", title: "CUSTOMER ID" },
          { id: "action_taken", title: "ACTION TAKEN" },
          { id: "timestamp", title: "TIMESTAMP" },
        ],
      })

      await csvWriter.writeRecords(actions)

      console.log("report is ready!")
    }
  } catch (error) {
    console.log(error)
  }
}

function generateLogins(userId: string, date: Date) {
  const creationDate = new Date(date)
  const today = new Date()

  const dateArray: Action[] = []

  // Start with the creation date
  let currentDate = creationDate

  while (currentDate <= today) {
    dateArray.push({
      customer_id: String(userId),
      action_taken: "LOGIN",
      timestamp: currentDate,
    })

    // Generate a random interval between 1 and 10 days (you can adjust the range as needed)
    const daysInterval = Math.floor(Math.random() * 10) + 1

    // Increment the date by the random interval
    currentDate = new Date(currentDate)
    currentDate.setDate(currentDate.getDate() + daysInterval)
  }

  return dateArray
}

async function getMessageActions(userId: string) {
  const channels = await getSendBirdUserChannels(String(userId))
  if (channels.length !== 0) {
    const messages = await getMessagesInChannel(channels[0].channel_url, 100)
    const userMessages = messages.filter(
      (m) => String(m.user.user_id) == String(userId)
    )

    const actions: Action[] = userMessages.map((m) => ({
      customer_id: String(userId),
      action_taken: "MESSAGE_SENT",
      timestamp: new Date(m.created_at),
    }))

    return actions
  }

  return []
}

connectToMongo()
getPatientActionList()

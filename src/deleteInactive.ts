import axios from "axios"
import fs from "fs"
import stripe from "stripe"
import { User, UserModel } from "./schema/user.schema"
import { UserTaskModel } from "./schema/task.user.schema"
import dayjs from "dayjs"

const STRIPE_SECRET_KEY =
  "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"
// const STRIPE_PUBLISHABLE_KEY = "pk_live_51K4tkPDOjl0X0gOqSYMtBYVk2ONkpC1Si8nJy4Ys21CZbySE4HH851Z7AuQOB6hGs8Ygll2PFTmnSF5dbwu3i1nN003yFGBbih"
const stripeSdk = new stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2022-08-01",
})

const deletedUsers: User[] = []

async function getAkutePatientIdByEmail(email: any) {
  try {
    const data = await axios.get(
      `https://api.akutehealth.com/v1/patients?email=${email}`,
      {
        headers: {
          "X-API-Key":
            "AQICAHhkrMEWLGV5I/np1unkQq0g8FND1rTDMACXtGdiXD8PWwEbevf2QazRBT77NExozLQrAAAAjzCBjAYJKoZIhvcNAQcGoH8wfQIBADB4BgkqhkiG9w0BBwEwHgYJYIZIAWUDBAEuMBEEDOKeqNdyE7rPlre14gIBEIBLhbPBozENXpVhzhiCYqyXGdbQFJaTYjsbvTASOeRlJqDzNWl6H/Uvas0WHeZfOVUe/FFaG/5GgxtCGAryapyfG8DhH9BqvZ7TZjDB",
        },
      }
    )
    return data
  } catch (error) {
    console.log(error)
    return false
  }
}

async function cancelStripeSubscription(stripeCustomerId: any, email: any) {
  try {
    // Lookup the user by email in stripe to get the stripeSubscriptionId and the subscriptionExpiresAt
    const getStripeUserSubscriptionInformation =
      await stripeSdk.subscriptions.list({
        customer: stripeCustomerId,
      })
    const stripeSubscriptionId = getStripeUserSubscriptionInformation.data[0].id

    if (getStripeUserSubscriptionInformation.data.length === 0) {
      return true
    } else if (
      getStripeUserSubscriptionInformation.data[0].status !== "active" &&
      getStripeUserSubscriptionInformation.data[0].status !== "trialing"
    ) {
      const cancelled = await stripeSdk.subscriptions.cancel(
        stripeSubscriptionId
      )
      console.log(
        `CANCELLED STRIPE SUBSCRIPTION (${cancelled.id}) FOR USER: ${email}`
      )
    } else {
      console.log(
        `STRIPE SUBSCRIPTION (${stripeSubscriptionId}) ALREADY INACTIVE FOR USER: ${email}`
      )
    }

    return true
  } catch (e) {
    console.log(
      `AN ERROR OCCURED CANCELLING STRIPE SUBSCRIPTION FOR USER (${email}): ${JSON.stringify(
        e
      )}`
    )
    return false
  }
}

async function deleteUsers(results: User[]) {
  // Add the stripeSubscriptionId and the subscriptionExpiresAt to the results
  console.log(results.length)
  for (let i = 0; i < results.length; i++) {
    const akutePatient = await getAkutePatientIdByEmail(results[i].email)

    if (akutePatient && !akutePatient.data[0]) {
      console.log(`NO AKUTE INFO FOUND FOR USER: ${results[i].email}`)
    } else if (akutePatient) {
      const status = akutePatient.data[0].status

      if (status !== "active") {
        await cancelStripeSubscription(
          results[i].stripeCustomerId,
          results[i].email
        )
        deletedUsers.push(results[i])
        const deleted = await UserModel.deleteOne({ _id: results[i]._id })
        const deletedTasks = await UserTaskModel.deleteMany({
          user: results[i]._id,
        })
        console.log(
          `DELETED USER (${results[i].email}) FROM DB: ${deleted.acknowledged}`
        )
        console.log(
          `DELETED USER (${results[i].email}) TASKS FROM DB: ${deletedTasks.deletedCount}`
        )
      } else {
        console.log(`AKUTE IS ACTIVE FOR USER: ${results[i].email}`)
      }
    } else {
      console.log(`NO AKUTE INFO FOUND FOR USER: ${results[i].email}`)
    }
  }
}

export async function deleteInactiveUsersScript() {
  const users = await UserModel.find({}).limit(1000)
  // await deleteUsers(users)

  const _users = users.map((u) => u.email)

  fs.writeFile(
    `./deleted-users-${dayjs().format("MM-DD-YYYY")}.json`,
    JSON.stringify(_users),
    "utf8",
    (err) => {
      if (err) {
        throw err
      }

      console.log("Data has been written to file successfully.")
    }
  )
}

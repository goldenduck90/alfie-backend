// In this file we will be creating a new user script. The new users will come from a CSV file.
// We need to follow the create createUser function from the user.service.ts file.
// Steps:
// 1. Read the CSV file
// 2. Lookup the user by email in stripe to get the stripeSubscriptionId and the subscriptionExpiresAt
// 3. Call the createUser function from the user.service.ts file with the CreateUserInput type which will create the user in the database.


// import { CreateUserInput } from './schema/user.schema';
import UserService from "./services/user.service"
// import { readFileSync } from 'fs';
import axios from "axios"
import csv from "csv-parser"
import fs from "fs"
import stripe from "stripe"
import { connectToMongo } from "./utils/mongo"

const STRIPE_SECRET_KEY = "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"
const STRIPE_PUBLISHABLE_KEY = "pk_live_51K4tkPDOjl0X0gOqSYMtBYVk2ONkpC1Si8nJy4Ys21CZbySE4HH851Z7AuQOB6hGs8Ygll2PFTmnSF5dbwu3i1nN003yFGBbih"
const stripeSdk = new stripe(STRIPE_SECRET_KEY, {
    apiVersion: "2022-08-01",
})
const userService = new UserService()
async function getAkutePatientIdByEmail(email: any) {
    try {
        const data = await axios.get(`https://api.akutehealth.com/v1/patients?email=${email}`, {
            headers: {
                "X-API-Key": "AQICAHhkrMEWLGV5I/np1unkQq0g8FND1rTDMACXtGdiXD8PWwEbevf2QazRBT77NExozLQrAAAAjzCBjAYJKoZIhvcNAQcGoH8wfQIBADB4BgkqhkiG9w0BBwEwHgYJYIZIAWUDBAEuMBEEDOKeqNdyE7rPlre14gIBEIBLhbPBozENXpVhzhiCYqyXGdbQFJaTYjsbvTASOeRlJqDzNWl6H/Uvas0WHeZfOVUe/FFaG/5GgxtCGAryapyfG8DhH9BqvZ7TZjDB",
            },
        })
        return data
    } catch (error) {
        console.log(error)
    }
}
async function findStripeSubscriptionIdAndSubscriptionExpiresAt(email: any) {
    // console.log(email, "email")
    // Lookup the user by email in stripe to get the stripeSubscriptionId and the subscriptionExpiresAt
    const getStripeUserByEmail = await stripeSdk.customers.list({
        email: email,
    })
    const getStripeUserSubscriptionInformation = await stripeSdk.subscriptions.list({
        customer: getStripeUserByEmail.data[0].id,
    })
    const stripeSubscriptionId = getStripeUserSubscriptionInformation.data[0].id
    const subscriptionExpiresAt = getStripeUserSubscriptionInformation.data[0].current_period_end
    const stripeCustomerId = getStripeUserByEmail.data[0].id
    return {
        stripeCustomerId,
        stripeSubscriptionId,
        subscriptionExpiresAt,
    }
}

function addStripeDataToResults(results: any) {
    // Add the stripeSubscriptionId and the subscriptionExpiresAt to the results
    return results.map(async (result: any) => {
        const { stripeSubscriptionId, subscriptionExpiresAt, stripeCustomerId } =
            await findStripeSubscriptionIdAndSubscriptionExpiresAt(result.EMAIL)
        const akutePatient = await getAkutePatientIdByEmail(result.EMAIL)
        if (!akutePatient.data[0]) {
            return {
                ...result,
                stripeSubscriptionId,
                subscriptionExpiresAt,
                stripeCustomerId,
                akutePatientId: null,
            }
        } else {
            return {
                ...result,
                stripeSubscriptionId,
                subscriptionExpiresAt,
                stripeCustomerId,
                akutePatientId: akutePatient.data[0].id,
            }
        }

    })
}
async function createNewUserScript() {
    try {
        const users: any = []
        fs.createReadStream("users.csv")
            .pipe(csv())
            .on("data", (csvData) => users.push(csvData))
            .on("end", async () => {
                const arrayOfPromises = await addStripeDataToResults(users)
                const results = await Promise.all(arrayOfPromises)

                const mappedResults: any = results.map((result) => {
                    return {
                        name: `${result["FIRST NAME"]} ${result["LAST NAME"]}`,
                        email: result.EMAIL,
                        phone: result.PHONE,
                        role: "Patient",
                        // make dateOfBirth a date object
                        dateOfBirth: new Date(result["DATE OF BIRTH"]),
                        address: {
                            line1: result["ADDRESS LINE 1"],
                            line2: result["ADDRESS LINE 2"],
                            city: result["CITY"],
                            state: result["STATE"],
                            postalCode: result["POSTAL CODE"],
                            country: "US",
                        },
                        weightInLbs: result["WEIGHT (POUNDS)"],
                        gender: result["GENDER (M/F)"],
                        heightInInches: result["HEIGHT IN INCHES"],
                        stripeCustomerId: result.stripeCustomerId,
                        subscriptionExpiresAt: result.subscriptionExpiresAt,
                        stripeSubscriptionId: result.stripeSubscriptionId,
                        textOptIn: true,
                    }
                })
                console.log(mappedResults, "mappedResults")
                // call userService.createUser() with the mappedResults one at a time to create the users in mongo 

                for (let i = 0; i < mappedResults.length; i++) {
                    await userService.createUser(mappedResults[i])
                }
                // const create = await userService.createUser(mappedResults[0])                
            })
    } catch (error) {
        console.log(error)
    }
}
connectToMongo()
createNewUserScript()
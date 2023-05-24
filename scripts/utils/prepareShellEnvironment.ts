import dotenv from "dotenv"
import { connectToMongo } from "../../src/utils/mongo"
import * as Sentry from "@sentry/node"

export default async function prepareShellEnvironment() {
  dotenv.config()
  Sentry.init({
    dsn: "https://e99c3274029e405f9e1b6dd50a63fd85@o4504040965603328.ingest.sentry.io/4504040986705920",
    environment: process.env.NODE_ENV,
    // Set tracesSampleRate to 1.0 to capture 100%
    // of transactions for performance monitoring.
    // We recommend adjusting this value in production
    tracesSampleRate: 1.0,
  })

  await connectToMongo()
}

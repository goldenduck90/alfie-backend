import dotenv from "dotenv"
dotenv.config()

import { connectToMongo } from "../../src/utils/mongo"
import { setupSentry } from "../../src/utils/sentry"

export default async function prepareShellEnvironment() {
  setupSentry()
  await connectToMongo()
}

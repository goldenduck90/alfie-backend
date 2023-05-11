import dotenv from "dotenv"
import { connectToMongo } from "../../src/utils/mongo"
import { setupSentry } from "../../src/utils/sentry"

export default async function prepareShellEnvironment() {
  dotenv.config()
  setupSentry()
  await connectToMongo()
}

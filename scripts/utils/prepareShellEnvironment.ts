import dotenv from "dotenv"
dotenv.config()

import "../../src/utils/sentry"
import { connectToMongo } from "../../src/utils/mongo"

export default async function prepareShellEnvironment() {
  await connectToMongo()
}

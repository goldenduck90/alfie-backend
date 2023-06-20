import dotenv from "dotenv"
dotenv.config()

import { basename } from "path"
import "../../src/utils/sentry"
import { connectToMongo } from "../../src/utils/mongo"

export default async function runShell(callback: () => Promise<void>) {
  await connectToMongo()

  try {
    await callback()

    process.exit(0)
  } catch (error) {
    console.log(
      `Error in ${basename(__filename)}: ${error?.message ?? String(error)}`
    )
    process.exit(1)
  }
}

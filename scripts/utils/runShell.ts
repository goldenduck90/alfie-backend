import dotenv from "dotenv"
dotenv.config()
import config from "config"
import { Command } from "commander"

import { basename } from "path"
import { setupSentry } from "../../src/utils/sentry"
import { connectToMongo } from "../../src/utils/mongo"

export default async function runShell(callback: () => Promise<void>) {
  try {
    const env = config.get<string>("env")
    if (env !== process.env.NODE_ENV) {
      throw new Error(
        `Config env ${env} does not match process env ${process.env.NODE_ENV}`
      )
    }

    console.log(`Running script in ${env}`)

    // setupenvironment
    setupSentry()
    await connectToMongo()

    // perform the work
    await callback()

    // wait for sentry logs to process
    await new Promise((resolve) => setTimeout(resolve, 400))

    process.exit(0)
  } catch (error) {
    console.log(
      `Error in ${basename(__filename)}: ${error?.message ?? String(error)}`
    )
    console.log(error)
    process.exit(1)
  }
}

export function createProgram(): Command {
  return new Command()
}

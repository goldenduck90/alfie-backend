import dotenv from "dotenv"
dotenv.config()
import config from "config"
import { Command } from "commander"

import { basename } from "path"
import "../../src/utils/sentry"
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

    await connectToMongo()

    await callback()

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

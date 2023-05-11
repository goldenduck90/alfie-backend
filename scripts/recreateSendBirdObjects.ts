import { Command } from "commander"
import prepareShellEnvironment from "./utils/prepareShellEnvironment"
import { findAndTriggerEntireSendBirdFlowForAllUsersAndProvider } from "../src/utils/sendBird"

const program = new Command()

program
  .description(
    "Recreates the sendbird state to be in sync with the database. Optionally deletes existing sendbird users/channels."
  )
  .option(
    "-d, --delete",
    "Delete sendbird channels and groups before synchronizing with database."
  )

program.parse()

const { delete: deleteEntities } = program.opts()

async function recreateSendBirdObjects() {
  await prepareShellEnvironment()

  await findAndTriggerEntireSendBirdFlowForAllUsersAndProvider(
    Boolean(deleteEntities)
  )
}

recreateSendBirdObjects()

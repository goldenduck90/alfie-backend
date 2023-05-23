import { Command } from "commander"
import prepareShellEnvironment from "./utils/prepareShellEnvironment"
import { findAndTriggerEntireSendBirdFlowForAllUsersAndProvider } from "../src/utils/sendBird"

const program = new Command()

program.description(
  "Synchronizes the sendbird state to be in sync with the database. Only removes unused items from sendbird."
)
program.option(
  "--dry-delete",
  "Whether to only report items to delete, instead of actually deleting them. Still runs other non-destructive parts of script."
)

program.parse()

const options = program.opts()
const dryDelete = Boolean(options.dryDelete)

async function synchronizeSendbird() {
  await prepareShellEnvironment()

  if (dryDelete) {
    console.log("Dry Delete run.")
  }

  try {
    await findAndTriggerEntireSendBirdFlowForAllUsersAndProvider(dryDelete)
  } catch (error) {
    console.log("Error during synchronizeSendbird script: ", error)
    process.exit(1)
  }

  process.exit(0)
}

synchronizeSendbird()

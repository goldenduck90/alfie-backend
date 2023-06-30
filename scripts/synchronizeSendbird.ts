import runShell, { createProgram } from "./utils/runShell"
import { findAndTriggerEntireSendBirdFlowForAllUsersAndProvider } from "../src/utils/sendBird"

const program = createProgram()
  .description(
    "Synchronizes the sendbird state to be in sync with the database. Use additional options to remove unused entities."
  )
  .option(
    "--dry-delete",
    "Whether to only report items to delete, instead of actually deleting them. Still runs other non-destructive parts of script."
  )
  .option("--remove-users", "Whether to remove unused users from sendbird.")
  .option(
    "--remove-channels",
    "Whether to remove unused channels from sendbird."
  )
  .option("--user <email>", "The email of a specific user to synchronize")
  .parse()

const options = program.opts()
const dryDelete = Boolean(options.dryDelete)
const userEmail = options.user
const removeUnusedChannels = Boolean(options.removeChannels)
const removeUnusedUsers = Boolean(options.removeUsers)

async function synchronizeSendbird() {
  if (dryDelete) {
    console.log("Dry Delete run, no entities will be deleted.")
  }

  if (userEmail) {
    console.log(`For user ID/email: ${userEmail}.`)
  }

  try {
    await findAndTriggerEntireSendBirdFlowForAllUsersAndProvider({
      dryDelete,
      userEmail,
      removeUnusedChannels,
      removeUnusedUsers,
    })
  } catch (error) {
    console.log("Error during synchronizeSendbird script: ", error)
    process.exit(1)
  }

  process.exit(0)
}

runShell(() => synchronizeSendbird())

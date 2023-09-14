import runShell, { createProgram } from "./utils/runShell"
import { validateAutoInvitesWithInUserSendbirdChannel } from "../src/utils/sendBird"

const program = createProgram()
  .description("Fix Sendbird channel user discrepancy.")
  .option("--user <ID>", "The id of a specific user to synchronize")
  .parse()

const options = program.opts()
const userId = options.user

async function synchronizeSendbird() {
  if (userId) {
    console.log(`For user ID: ${userId}.`)
  }

  try {
    await validateAutoInvitesWithInUserSendbirdChannel({
      userId: userId,
    })
  } catch (error) {
    console.log("Error during synchronizeSendbird script: ", error)
    process.exit(1)
  }

  process.exit(0)
}

runShell(() => synchronizeSendbird())

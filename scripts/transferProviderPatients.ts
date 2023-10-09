import UserService from "../src/services/user.service"
import runShell, { createProgram } from "./utils/runShell"

const program = createProgram()
  .description("Transform patients under a provider to another.")
  .option("--oldProvider <ID>", "Specifies the old provider ID")
  .option("--newProvider <ID>", "Specifies the new provider ID")
  .parse()

const options = program.opts()
const oldProviderID = options.oldProvider
const newProviderID = options.newProvider

async function transferProviderPatients() {
  console.log(`Script parameters: ${options}.`)

  // Validate script inputs
  if (!oldProviderID) {
    throw new Error("The old provider user id is required.")
  } else if (!newProviderID) {
    throw new Error("The new provider user id is required.")
  }

  try {
    const userService = new UserService()
    await userService.transferPatients(oldProviderID, newProviderID)
  } catch (error) {
    console.log("Error during transferProviderPatients script: ", error)
    process.exit(1)
  }

  process.exit(0)
}

runShell(() => transferProviderPatients())

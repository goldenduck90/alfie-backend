import UserService from "../src/services/user.service"
import runShell from "./utils/runShell"

const oldProviderID = "649a80737bf2521707603614"
const newProviderID = "634f85f8ed227ada5a4c1414"
const patientIds = ["654ae90f931d182cc6c7f4d6"]

async function transferProviderPatientsSpecific() {
  // Validate script inputs
  if (!oldProviderID) {
    throw new Error("The old provider user id is required.")
  } else if (!newProviderID) {
    throw new Error("The new provider user id is required.")
  }

  try {
    const userService = new UserService()
    await userService.transferPatients(oldProviderID, newProviderID, patientIds)
  } catch (error) {
    console.log("Error during transferProviderPatients script: ", error)
    process.exit(1)
  }

  process.exit(0)
}

runShell(() => transferProviderPatientsSpecific())

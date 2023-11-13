import UserService from "../src/services/user.service"
import runShell from "./utils/runShell"

const oldProviderID = "634f85f8ed227ada5a4c1414"
const newProviderID = "649a800e7bf2521707603612"
const patientIds = [
  "6548fa0d931d182cc6c7d0bf",
  "6543e54b931d182cc6c78fad",
  "6542702d931d182cc6c77b11",
  "65415516931d182cc6c76c95",
  "653ff745931d182cc6c75ac8",
  "653bd407931d182cc6c72dba",
  "65527f3d8e3ba5e414b088ec",
]

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

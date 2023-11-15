import AkuteService from "../src/services/akute.service"
import runShell, { createProgram } from "./utils/runShell"
import { captureException } from "../src/utils/sentry"
import { captureEvent } from "../src/utils/sentry"
import { UserModel } from "../src/schema/user.schema"

const program = createProgram()
  .description("Create akute patient and assign to user")
  .option("--userId <ID>", "Specifies the user ID")
  .parse()

const options = program.opts()
const userId = program.args[0]

async function createAkutePatient() {
  console.log(`Script parameters: ${JSON.stringify(program.args)}.`)

  // Validate script inputs
  if (!userId) {
    throw new Error("The user id is required.")
  }

  try {
    const akuteService = new AkuteService()
    const user = await UserModel.findById(userId)
    const splitName = user.name.split(" ")
    const firstName = splitName[0] || ""
    const lastName = splitName[splitName.length - 1] || ""

    const input = {
      firstName: firstName,
      lastName: lastName,
      email: user.email,
      phone: user.phone,
      dateOfBirth: user.dateOfBirth,
      address: user.address,
      sex: user.gender,
    }

    try {
      const patientId = await akuteService.createPatient(input)
      if (!patientId) {
        const message = `UserService.createUser: An error occured for creating a patient entry in Akute for: ${input.email}`
        captureEvent("error", message)
      }

      user.akutePatientId = patientId
      await user.save()
      await akuteService.createLabOrder(user._id)
    } catch (error) {
      captureException(error, "UserService.createUser", input)
    }
  } catch (error) {
    console.log("Error during transferProviderPatients script: ", error)
    process.exit(1)
  }

  process.exit(0)
}

runShell(() => createAkutePatient())

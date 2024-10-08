import runShell from "./utils/runShell"
import CandidService from "../src/services/candid.service"
import AppointmentService from "../src/services/appointment.service"
import { UserModel } from "../src/schema/user.schema"
import { Provider } from "../src/schema/provider.schema"

console.log("Starting get encounter.")

async function testGetEncounter() {
  // prepare user sandbox values.
  const user = await UserModel.findOne({
    email: "john-paul+user@joinalfie.com",
  }).populate<{ provider: Provider }>("provider")

  const appointmentService = new AppointmentService()
  const candidService = new CandidService()

  const appointment = await appointmentService.getAppointment({
    eaAppointmentId: "2",
    timezone: "America/New_York",
  })
  const encounter = await candidService.getEncounterForAppointment(
    appointment,
    user
  )

  console.log("encounter", JSON.stringify(encounter, null, "  "))

  process.exit(0)
}

runShell(() => testGetEncounter())

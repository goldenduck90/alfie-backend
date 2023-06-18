import prepareShellEnvironment from "./utils/prepareShellEnvironment"
import CandidService from "../src/services/candid.service"
import { InsuranceEligibilityInput, UserModel } from "../src/schema/user.schema"
import { Provider } from "../src/schema/provider.schema"
import AppointmentService from "../src/services/appointment.service"
import UserService from "../src/services/user.service"

console.log("Starting test insurance script.")

async function testInsurance() {
  await prepareShellEnvironment()

  const appointmentService = new AppointmentService()
  const candidService = new CandidService()
  const userService = new UserService()

  // prepare user sandbox values.
  const user = await UserModel.findOne({
    email: "test+insurance1@joinalfie.com",
  }).populate<{ provider: Provider }>("provider")

  const { provider } = user

  const input: InsuranceEligibilityInput = {
    groupId: "0000000000",
    groupName: "group name",
    memberId: "0000000000",
    // https://developers.changehealthcare.com/eligibilityandclaims/docs/use-the-test-payers-in-the-sandbox-api
    payor: "00803",
    insuranceCompany: "NEW YORK EMPIRE BLUE SHIELD",
    rxBin: "12345",
    rxGroup: "abcdefg",
    userId: user._id.toString(),
  }

  await userService.updateInsurance(input)

  await candidService.checkInsuranceEligibility(
    user,
    provider,
    input,
    /**
     * The CPID here is optional and used for sandbox testing purposes.
     * Normally, the CPID will be looked up in cpids.json from the payer ID/name.
     */
    "00007" // active coverage
    // "000031" // inactive coverage
    // "000040" // non covered
    // "000047" // deductible
  )

  const appointment = await appointmentService.getAppointment({
    eaAppointmentId: "4",
    timezone: "America/New_York",
  })
  const initialAppointment = await appointmentService.getInitialAppointment(
    user.eaCustomerId
  )
  console.log(
    "Appointments used for CandidService.createCodedEncounter",
    JSON.stringify({
      userId: user.eaCustomerId,
      appointment,
      initialAppointment,
    })
  )

  await candidService.createCodedEncounterForAppointment(
    appointment,
    initialAppointment
  )

  process.exit(0)
}

testInsurance().catch((error) => {
  console.error(error?.message || error)
  process.exit(1)
})

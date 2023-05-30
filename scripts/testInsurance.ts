import prepareShellEnvironment from "./utils/prepareShellEnvironment"
import CandidService from "../src/services/candid.service"
import { InsuranceEligibilityInput, UserModel } from "../src/schema/user.schema"
import { Provider } from "../src/schema/provider.schema"
import AppointmentService from "../src/services/appointment.service"

console.log("Starting test insurance script.")

async function testInsurance() {
  await prepareShellEnvironment()

  const candidService = new CandidService()

  // prepare user sandbox values.
  const user = await UserModel.findOne({
    email: "john-paul+user@joinalfie.com",
  }).populate<{ provider: Provider }>("provider")
  user.name = "johnone doeone"
  user.dateOfBirth = new Date("1980-01-02")
  user.address.line1 = "123 address1"
  user.address.line2 = "123"
  user.address.city = "city1"
  user.address.state = "WA"
  user.address.postalCode = "981010000"
  user.phone = "123456789"
  user.email = "email@email.com"

  // prepare provider sandbo values
  const { provider } = user
  provider.npi = "0123456789"
  provider.firstName = "johnone"
  provider.lastName = "doeone"

  const input: InsuranceEligibilityInput = {
    groupId: "0000000000",
    groupName: "group name",
    memberId: "0000000000",
    payor: "00019", // https://developers.changehealthcare.com/eligibilityandclaims/docs/use-the-test-payers-in-the-sandbox-api
    insuranceCompany: "extra healthy insurance",
    rxBin: "12345",
    rxGroup: "abcdefg",
    userId: user._id.toString(),
  }

  const eligibility = await candidService.checkInsuranceEligibility(
    user,
    provider,
    input,
    "00007" // active coverage
    // "000031" // inactive coverage
    // "000040" // non covered
  )

  console.log("candid eligibility result")
  console.log(JSON.stringify(eligibility, null, "  "))

  const appointmentService = new AppointmentService()
  const appointment = await appointmentService.getAppointment({
    eaAppointmentId: "2",
    timezone: "America/New_York",
  })
  const encounter = await candidService.createCodedEncounter(
    user,
    provider,
    appointment,
    input
  )
  console.log("candid coded encounter result")
  console.log(JSON.stringify(encounter, null, "  "))

  process.exit(0)
}

testInsurance().catch((error) => {
  console.error(error?.message || error)
  process.exit(1)
})

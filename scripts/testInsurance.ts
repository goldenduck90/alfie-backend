import prepareShellEnvironment from "./utils/prepareShellEnvironment"
import CandidService from "../src/services/candid.service"
import { InsuranceEligibilityInput, UserModel } from "../src/schema/user.schema"
import { Provider } from "../src/schema/provider.schema"
import AppointmentService from "../src/services/appointment.service"

console.log("Starting test insurance script.")

async function testInsurance() {
  await prepareShellEnvironment()

  const appointmentService = new AppointmentService()
  const candidService = new CandidService(appointmentService)

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
  user.eaCustomerId = "3"

  // prepare provider sandbo values
  const { provider } = user
  provider.npi = "0123456789"
  provider.firstName = "johnone"
  provider.lastName = "doeone"

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

  await candidService.createCodedEncounter(
    user,
    provider,
    appointment,
    input,
    initialAppointment
  )

  process.exit(0)
}

testInsurance().catch((error) => {
  console.error(error?.message || error)
  process.exit(1)
})

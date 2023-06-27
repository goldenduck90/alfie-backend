import runShell from "./utils/runShell"
import { Command } from "commander"
import { Insurance, UserModel } from "../src/schema/user.schema"
import { Provider } from "../src/schema/provider.schema"
import CandidService from "../src/services/candid.service"
import AppointmentService from "../src/services/appointment.service"
import UserService from "../src/services/user.service"
import cpids from "../src/utils/cpids.json"
import { CPIDEntry } from "../src/utils/lookupCPID"

const program = new Command()
  .description(
    "Tests insurance flows: eligibility and post-appointment. If no flags are set, tests all scenarios."
  )
  .option("--eligibility", "Whether to only run an eligibility check.")
  .option(
    "--initial-appointment",
    "Whether to only create a coded encounter for the initial appointment case."
  )
  .option(
    "--followup-appointment",
    "Whether to only create a coded encounter for the follow-up appointment case."
  )
  .parse()

const flags = program.opts<{
  eligibility: boolean
  initialAppointment: boolean
  followupAppointment: boolean
}>()

if (Object.values(flags).every((value) => !value))
  for (const key in flags) (flags as Record<string, boolean>)[key] = true

console.log("Starting test insurance script.")

async function testInsurance() {
  const appointmentService = new AppointmentService()
  const candidService = new CandidService()
  const userService = new UserService()

  // prepare user sandbox values.
  const user = await UserModel.findOne({
    email: "test+insurance1@joinalfie.com",
  }).populate<{ provider: Provider }>("provider")

  const { provider } = user

  const input: Insurance = {
    groupId: "0000000000",
    groupName: "group name",
    memberId: "0000000000",
    // https://developers.changehealthcare.com/eligibilityandclaims/docs/use-the-test-payers-in-the-sandbox-api
    // payor: "00803",
    payor: null,
    insuranceCompany: "One Five",
    rxBin: "12345",
    rxGroup: "abcdefg",
  }

  cpids.splice(0, cpids.length, ...testCpids)

  if (flags.eligibility) {
    const result = await candidService.checkInsuranceEligibility(
      user,
      provider,
      input
    )

    console.log(`Final eligibility result: ${JSON.stringify(result)}`)

    await userService.updateInsurance(user, result.rectifiedInsurance)
  } else {
    await userService.updateInsurance(user, input)
  }

  if (flags.initialAppointment || flags.followupAppointment) {
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

    console.log("Creating a coded encounter for an initial appointment.")
    flags.initialAppointment &&
      (await candidService.createCodedEncounterForAppointment(
        appointment,
        appointment
      ))
    console.log("Creating a coded encounter for a follow-up appointment.")
    flags.followupAppointment &&
      (await candidService.createCodedEncounterForAppointment(
        appointment,
        initialAppointment
      ))
  }
}

runShell(() => testInsurance())

const testCpids: CPIDEntry[] = [
  { cpid: "000031", payer_id: "00200", primary_name: "Insurance One Five" }, // inactive coverage
  { cpid: "000040", payer_id: "00230", primary_name: "Insurance One" }, // non covered
  { cpid: "000047", payer_id: "00241", primary_name: "Insurance One Three" }, // deductible
  { cpid: "00007", payer_id: "00246", primary_name: "Insurance Two Four" }, // active coverage
  { cpid: "00001", payer_id: "00265", primary_name: "Insurance Two" }, // active coverage
]

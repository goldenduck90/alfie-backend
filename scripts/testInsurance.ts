import runShell from "./utils/runShell"
import { Command } from "commander"
import { Insurance, UserModel } from "../src/schema/user.schema"
import CandidService from "../src/services/candid.service"
import AppointmentService from "../src/services/appointment.service"
import UserService from "../src/services/user.service"
import cpids from "../src/utils/cpids.json"
import { CPIDEntry } from "../src/utils/lookupCPID"
import EmailService from "../src/services/email.service"
import { TaskType } from "../src/schema/task.schema"
import TaskService from "../src/services/task.service"

const program = new Command()
  .description(
    "Tests insurance flows: eligibility and post-appointment. If no flags are set, tests all scenarios."
  )
  .option("--eligibility", "Whether to test eligibility checks.")
  .option("--initial", "Whether to test insurance for initial appointments.")
  .option("--followup", "Whether to test insurance for follow-up appointments.")
  .option("--withings", "Whether to test withings insurance.")
  .parse()

const options = program.opts()
const keys = ["eligibility", "initial", "followup", "withings"]
const flags: {
  eligibility: boolean
  initial: boolean
  followup: boolean
  withings: boolean
} = keys.reduce((memo, key) => ({ ...memo, [key]: options[key] }), {} as any)

if (keys.every((key) => !(flags as Record<string, boolean>)[key]))
  for (const key of keys) (flags as Record<string, boolean>)[key] = true

console.log("Starting test insurance script.")

async function testInsurance() {
  EmailService.prototype.sendEmail = async (...args: any[]) => {
    console.log(`sendEmail call: ${JSON.stringify(args)}`)
    return { MessageId: "123", $response: {} as any }
  }

  const appointmentService = new AppointmentService()
  const candidService = new CandidService()
  const userService = new UserService()
  const taskService = new TaskService()

  // prepare user sandbox values.
  const user = await UserModel.findOne({
    email: "test+insurance1@joinalfie.com",
  })

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
    const result = await userService.checkInsuranceEligibility(user, input)

    console.log(`Final eligibility result: ${JSON.stringify(result)}`)
  } else {
    await userService.updateInsurance(user, input)
  }

  if (flags.initial || flags.followup) {
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
    flags.initial &&
      (await candidService.createCodedEncounterForAppointment(
        appointment,
        appointment
      ))
    console.log("Creating a coded encounter for a follow-up appointment.")
    flags.followup &&
      (await candidService.createCodedEncounterForAppointment(
        appointment,
        initialAppointment
      ))
  }

  if (flags.withings) {
    user.metriportUserId = "test-metriport-id"
    user.stripeSubscriptionId = null
    user.hasScale = false
    user.weights = [] as any
    await user.save()

    // process 17 scale readings. The 1st and 16th should create coded encounters.
    for (let i = 0; i < 17; i++) {
      await taskService.assignTaskToUser({
        taskType: TaskType.WEIGHT_LOG,
        userId: user._id.toString(),
      })

      await userService.processWithingsScaleReading(
        user.metriportUserId,
        230 + Math.round(Math.random() * 5)
      )
    }
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

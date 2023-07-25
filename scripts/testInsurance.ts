import runShell from "./utils/runShell"
import mockEmails from "./utils/mockEmails"
import config from "config"
import { Command } from "commander"
import { Insurance, UserModel } from "../src/schema/user.schema"
import CandidService from "../src/services/candid.service"
import AppointmentService from "../src/services/appointment.service"
import UserService from "../src/services/user.service"
import { TaskType } from "../src/schema/task.schema"
import TaskService from "../src/services/task.service"
import { analyzeS3InsuranceCardImage } from "../src/utils/textract"
import ProviderService from "../src/services/provider.service"
import { Provider } from "../src/schema/provider.schema"
import extractInsurance from "../src/utils/extractInsurance"

const program = new Command()
  .description(
    "Tests insurance flows: eligibility and post-appointment. If no flags are set, tests all scenarios."
  )
  .option("--eligibility", "Whether to test eligibility checks.")
  .option("--initial", "Whether to test insurance for initial appointments.")
  .option("--followup", "Whether to test insurance for follow-up appointments.")
  .option("--withings", "Whether to test withings insurance.")
  .option(
    "--s3-key <s3ObjectKey>",
    "The S3 object key from which to load an insurance card image."
  )
  .option(
    "--s3-bucket <s3BucketName>",
    "The S3 bucket from which to load the s3 key."
  )
  .option(
    "--email <email>",
    "The email of the user to use for testing.",
    "test+insurance1@joinalfie.com"
  )
  .parse()

const options = program.opts()
const keys = ["eligibility", "initial", "followup", "withings"]
const flags: {
  eligibility: boolean
  initial: boolean
  followup: boolean
  withings: boolean
} = keys.reduce((memo, key) => ({ ...memo, [key]: options[key] }), {} as any)

const email: string = options.email
const s3Key: string = options.s3Key
const s3Bucket: string = options.s3Bucket

if (keys.every((key) => !(flags as Record<string, boolean>)[key]))
  for (const key of keys) (flags as Record<string, boolean>)[key] = true

console.log("Starting test insurance script.")

async function testInsurance() {
  mockEmails()

  const appointmentService = new AppointmentService()
  const candidService = new CandidService()
  const userService = new UserService()
  const taskService = new TaskService()
  const providerService = new ProviderService()

  // prepare user sandbox values.
  const user = await UserModel.findOne({ email }).populate<{
    provider: Provider
  }>("provider")

  const provider = await providerService.getProviderByEmail(
    "hasan@joinalfie.com"
  )
  user.provider = provider
  await user.updateOne({ $set: { provider: provider._id } })

  let inputs: { insurance: Insurance; cpid: string }[] = [
    {
      insurance: {
        groupId: "0000000000",
        groupName: "group name",
        memberId: "0000000000",
        // https://developers.changehealthcare.com/eligibilityandclaims/docs/use-the-test-payers-in-the-sandbox-api
        // payor: "00803",
        payor: null,
        insuranceCompany: "One Five",
        rxBIN: "123456",
        rxPCN: "abcdefg",
        rxGroup: "",
      },
      cpid: "00007",
    },
  ]

  if (s3Key) {
    const extractResult = await analyzeS3InsuranceCardImage(
      s3Bucket ?? (config.get("s3.patientBucketName") as string),
      s3Key
    )
    console.log(`Extract result: ${JSON.stringify(extractResult)}`)

    inputs = extractInsurance(extractResult, {
      userState: user.address.state,
    })
    console.log(`Insurance Cards: ${JSON.stringify(inputs)}`)
  }

  if (flags.eligibility) {
    const result = await userService.checkInsuranceEligibility(user, inputs)

    console.log(`Final eligibility result: ${JSON.stringify(result)}`)
  } else {
    await userService.updateInsurance(user, inputs[0].insurance)
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

import runShell, { createProgram } from "./utils/runShell"
import AkuteService from "../src/services/akute.service"
import UserService from "../src/services/user.service"
import S3Service from "../src/services/s3.service"

const program = createProgram()
  .description(
    "Tests creating a lab order, then sending the order PDF by email to a user."
  )
  .option(
    "--user <userId>",
    "The user ID to use for the test.",
    "64887ab5b4b7e84130ac460f"
  )
  .option(
    "--email [email]",
    "Optional. An email to send the attachment to. Overrides user.email"
  )
  .option(
    "--mock",
    "Optional. Mock akute methods to test email attachment sending from createLabOrder."
  )
  .parse()

const {
  user: userId,
  email,
  mock,
} = program.opts<{ user: string; email: string; mock: boolean }>()

async function testLabOrderEmail() {
  const userService = new UserService()
  const akuteService = new AkuteService()

  const user = await userService.getUser(userId)

  if (mock) {
    // test the sending of the PDF, but not akute methods.
    const url = await new S3Service().getSignedUrl(
      {
        key: "Test_Userten/Example Lab Order.pdf",
        contentType: "application/pdf",
        versionId: "TpHBi.V3fdgtjLHbKJrlh2rbhBLHUXAg",
      },
      "get"
    )

    AkuteService.prototype.getLabOrder = async function () {
      return { id: "xyz", document_id: "test-document-id" }
    } as any
    AkuteService.prototype.getDocument = async function () {
      return {
        url,
        id: "test-document-id",
        created_at: "",
        external_patient_id: userId,
        file_name: "file-name.pdf",
        last_updated: "",
        patient_id: "1",
        tags: [],
      }
    }
    akuteService.axios.post = async function () {
      return { data: { id: "test-lab-order-id" } }
    } as any
  }

  const existingPatient = user.akutePatientId
    ? await akuteService.getPatient(user.akutePatientId)
    : null
  const patientId =
    existingPatient?.id ??
    (await akuteService.createPatient({
      address: user.address,
      dateOfBirth: user.dateOfBirth,
      firstName: user.name.split(" ")[0],
      lastName: user.name.split(" ")[1],
      email: user.email,
      phone: user.phone, // must be a valid phone
      sex: user.gender,
    }))

  console.log(
    `Patient: ${JSON.stringify(await akuteService.getPatient(patientId))}`
  )
  user.akutePatientId = patientId

  user.labOrderSent = false
  const originalEmail = user.email
  if (email) user.email = email
  await user.save()

  try {
    const { labOrderId } = await akuteService.createLabOrder(
      user._id.toString()
    )
    const order = await akuteService.getLabOrder(labOrderId)
    console.log(`Order: ${JSON.stringify(order, null, "  ")}`)
    const document = await akuteService.getDocument(order.document_id)
    console.log(`Document: ${JSON.stringify(document, null, "  ")}`)
  } catch (error) {
    console.log(`Error during create lab order: ${error}`)
  }

  user.email = originalEmail
  await user.save()
}

runShell(() => testLabOrderEmail())

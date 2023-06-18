import UserService from "../src/services/user.service"
import prepareShellEnvironment from "./utils/prepareShellEnvironment"

async function testWithingsInsurance() {
  await prepareShellEnvironment()
  const userService = new UserService()

  const user = await userService.getUser("648c9a95c0293d72a4e5e7dd")
  user.metriportUserId = "test-metriport-id"
  user.stripeSubscriptionId = null
  user.hasScale = false
  user.weights = [] as any
  await user.save()

  // first scale reading
  await userService.handleWithingsWeight(
    user.metriportUserId,
    230 + Math.round(Math.random() * 5)
  )

  // sixteenth scale reading.
  for (let i = 0; i < 15; i++) {
    await userService.handleWithingsWeight(
      user.metriportUserId,
      230 + Math.round(Math.random() * 5)
    )
  }
}

testWithingsInsurance()
  .then(() => process.exit(0))
  .catch(() => process.exit(1))

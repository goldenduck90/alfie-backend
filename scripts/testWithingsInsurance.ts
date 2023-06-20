import UserService from "../src/services/user.service"
import runShell from "./utils/runShell"

async function testWithingsInsurance() {
  const userService = new UserService()

  const user = await userService.getUser("648c9a95c0293d72a4e5e7dd")
  user.metriportUserId = "test-metriport-id"
  user.stripeSubscriptionId = null
  user.hasScale = false
  user.weights = [] as any
  await user.save()

  // first scale reading
  await userService.processWithingsScaleReading(
    user.metriportUserId,
    230 + Math.round(Math.random() * 5)
  )

  // sixteenth scale reading.
  for (let i = 0; i < 18; i++) {
    await userService.processWithingsScaleReading(
      user.metriportUserId,
      230 + Math.round(Math.random() * 5)
    )
  }
}

runShell(() => testWithingsInsurance())

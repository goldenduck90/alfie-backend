import { TaskType } from "../src/schema/task.schema"
import EmailService from "../src/services/email.service"
import TaskService from "../src/services/task.service"
import UserService from "../src/services/user.service"
import runShell from "./utils/runShell"

async function testWithingsInsurance() {
  const userService = new UserService()
  const taskService = new TaskService()
  EmailService.prototype.sendEmail = async (...args: any[]) => {
    console.log(`sendEmail call: ${JSON.stringify(args)}`)
    return { MessageId: "123", $response: {} as any }
  }

  const user = await userService.getUser("648c9a95c0293d72a4e5e7dd")
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

runShell(() => testWithingsInsurance())

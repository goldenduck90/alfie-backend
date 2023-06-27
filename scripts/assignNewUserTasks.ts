import runShell from "./utils/runShell"
import UserService, { initialUserTasks } from "../src/services/user.service"
import { Command } from "commander"
import TaskService from "../src/services/task.service"
import { TaskType } from "../src/schema/task.schema"

const program = new Command()

program.description(
  "Assign tasks to a user whose tasks were not assigned on registration for some reason."
)

program.option("--user <userId>", "The user ID to assign new user tasks to.")

program.parse()

const options = program.opts()
const userId = options.user

async function assignNewUserTasks() {
  console.log(`Starting assign new user tasks. User ID: ${userId}`)
  const userService = new UserService()
  const taskService = new TaskService()

  const withingsTask = await taskService.getTaskByType(
    TaskType.CONNECT_WITHINGS_SCALE
  )
  if (!withingsTask) {
    const newTask = await taskService.createTask({
      name: "Connect Withings Scale",
      type: TaskType.CONNECT_WITHINGS_SCALE,
      canHaveMultiple: false,
      daysTillDue: 6,
      highPriority: false,
    })
    console.log(`Created withings task: ${JSON.stringify(newTask)}`)
  }

  const user = await userService.getUser(userId)
  const result = await userService.assignUserTasks(user._id, initialUserTasks)
  console.log(`Result: ${JSON.stringify(result, null, "  ")}`)
}

runShell(() => assignNewUserTasks())

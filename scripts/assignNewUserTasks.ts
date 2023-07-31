import runShell from "./utils/runShell"
import UserService, { initialUserTasks } from "../src/services/user.service"
import { Command } from "commander"
import TaskService from "../src/services/task.service"
import { Task, TaskType } from "../src/schema/task.schema"

const program = new Command()
  .description(
    "Assign tasks to a user whose tasks were not assigned on registration for some reason."
  )
  .requiredOption("--user <userId>", "The user ID to assign new user tasks to.")
  .option(
    "--task <tasks...>",
    "Specific tasks to assign. Defaults to the default initial user tasks."
  )
  .parse()

const options = program.opts<{ user: string; task?: string[] }>()
const userId = options.user

async function assignNewUserTasks() {
  console.log(`Starting assign new user tasks. User ID: ${userId}`)
  const userService = new UserService()
  const taskService = new TaskService()

  const tasks: Task[] = []
  const taskTypeStrings = options.task ?? initialUserTasks
  for (const taskType of taskTypeStrings) {
    const task = await taskService.getTaskByType(taskType as TaskType)
    if (!task) {
      console.log(`Error: Invalid task type: ${taskType}`)
    } else {
      tasks.push(task)
    }
  }

  const taskTypes = tasks.map(({ type }) => type)
  console.log(
    `Assigning tasks: ${tasks
      .map(({ type, _id }) => `${_id}: ${type}`)
      .join(", ")}`
  )

  const user = await userService.getUser(userId)
  try {
    const result = await userService.assignUserTasks(user._id, taskTypes)
    console.log(`Result: ${JSON.stringify(result, null, "  ")}`)
  } catch (error) {
    console.log(`Error: ${error.message}`)
  }
}

runShell(() => assignNewUserTasks())

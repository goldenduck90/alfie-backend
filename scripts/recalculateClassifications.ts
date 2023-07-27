import TaskService from "../src/services/task.service"
import UserService from "../src/services/user.service"
import { pickFields } from "../src/utils/collections"
import runShell, { createProgram } from "./utils/runShell"
import { writeFileSync } from "fs"
import { resolve } from "path"

const program = createProgram()
  .description(
    "Recalculates scores and classifications for all users, or a given user based on the entire user task history."
  )
  .option(
    "--user <userId>",
    "Optional. The user ID whose scores/classifications to recalculate. Defaults to all users."
  )
  .option(
    "--file <fileName>",
    "Optional. A file to which to output a JSON-formatted summary of errors, before and after data."
  )
  .parse()

const { user: userId, file: fileName } = program.opts<{
  user?: string
  file?: string
}>()

/**
 * Recalculates scores and classifications for all users, or a given user.
 * Overwrites previous scores and classifications, and bases updated data
 * on the entire user task history.
 */
async function recalculateClassifications() {
  const taskService = new TaskService()
  const userService = new UserService()

  const users = (
    userId
      ? [await userService.getUser(userId)]
      : await userService.getAllPatients()
  ).filter((user) => user)

  const results = []
  for (const user of users) {
    console.log(`Recalculating scores/classifications for ${user._id}`)
    try {
      const before = pickFields(user, "score", "classifications")
      await taskService.recalculateProfiling(user._id)
      const updatedUser = await userService.getUser(user._id)
      const after = pickFields(updatedUser, "score", "classifications")
      results.push({
        userId: user._id.toString(),
        before,
        after,
      })
    } catch (error) {
      results.push({
        userId: user._id.toString(),
        error: error.message,
      })
    }
  }

  if (fileName) {
    const str = JSON.stringify(results, null, "  ")
    const target = resolve(process.cwd(), fileName)
    console.log(`Writing results file to ${target}`)
    writeFileSync(fileName, str, "utf-8")
  }
}

runShell(() => recalculateClassifications())

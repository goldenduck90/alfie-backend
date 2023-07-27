import runShell from "./utils/runShell"
import TaskService from "../src/services/task.service"

/**
 * Fixes answer format for all answers in the database, converting
 * values to the correct format, and types to the correct type based
 * on the Task.questions template.
 */
async function fixMongoUserAnswers() {
  const taskService = new TaskService()
  await taskService.correctUserAnswersFromTaskQuestions(false)
}

runShell(() => fixMongoUserAnswers())

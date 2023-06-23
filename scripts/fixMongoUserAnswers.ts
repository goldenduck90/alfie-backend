import runShell from "./utils/runShell"
import TaskService from "../src/services/task.service"

async function fixMongoUserAnswers() {
  const taskService = new TaskService()
  await taskService.correctUserAnswersFromTaskQuestions(false)
}

runShell(() => fixMongoUserAnswers())

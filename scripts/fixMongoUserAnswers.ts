import prepareShellEnvironment from "./utils/prepareShellEnvironment"
import TaskService from "../src/services/task.service"

async function fixMongoUserAnswers() {
  await prepareShellEnvironment()

  const taskService = new TaskService()
  await taskService.cleanupUserTaskAnswersFromTaskQuestions()
}

fixMongoUserAnswers()
  .then(() => process.exit(0))
  .catch((error) => {
    console.log(error)
    process.exit(1)
  })

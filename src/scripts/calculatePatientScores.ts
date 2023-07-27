import { calculateScore } from "../PROAnalysis"
import { Task } from "../schema/task.schema"
import { UserTaskModel } from "../schema/task.user.schema"
import { UserModel } from "../schema/user.schema"
import { captureException } from "../utils/sentry"

/** Calculate all patient scores based on completed tasks, using the most recent answers. */
export async function calculatePatientScores(userId: string) {
  try {
    // First find all user tasks that are completed
    const userTasks = (
      await UserTaskModel.find({
        user: userId,
        completed: true,
      }).populate<{ task: Task }>("task")
    ).filter((task) => task.task)

    const user = await UserModel.findById(userId)

    // For each completed tasks group tasks by task
    const groupedTasks = userTasks.reduce((acc, task) => {
      const key = String(task.task._id)
      return {
        [key]: [...(acc[key] || []), task],
      }
    }, {} as Record<string, typeof userTasks[number][]>)

    // For each task group, find two most recent tasks to today. The first task should be the currentTask and the second task should be the previousTask
    const tasks = Object.keys(groupedTasks).map((taskId: string) => {
      const taskGroup = groupedTasks[taskId]
      const sortedTasks = taskGroup.sort((a, b) => {
        return (
          new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
        )
      })
      const lastTask = sortedTasks[0]
      const secondLastTask = sortedTasks[1]
      return {
        currentTask: lastTask,
        previousTask: secondLastTask,
      }
    })

    // For each task, calculate the score by using the calculateScore function
    const scores = tasks.map((task) => {
      const taskType = task.currentTask.task.type
      return calculateScore(task.previousTask, task.currentTask, taskType)
    })

    try {
      // remove duplicate scores by date match using date-fns however somes score won't have anything to compare to so we need to filter out undefined
      const uniqueScores = scores
        .filter((score) => score)
        .filter(
          (score, index, self) =>
            index ===
            self.findIndex(
              (s) =>
                s.date.getTime() === score.date.getTime() &&
                s.task === score.task
            )
        )

      // add new scores to user score array
      user.score.push(...uniqueScores)
      await user.save()
      return uniqueScores
    } catch (err) {
      captureException(err, "calculatePatientScores - error saving scores")
      throw err
    }
  } catch (error) {
    captureException(error, "calculatePatientScores - error calculating scores")
    throw error
  }
}

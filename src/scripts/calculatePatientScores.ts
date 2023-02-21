import { calculateScore } from "../PROAnalysis"
import { TaskModel } from "../schema/task.schema"
import { UserTaskModel } from "../schema/task.user.schema"
import { UserModel } from "../schema/user.schema"

export async function calculatePatientScores(patient: string) {
  try {
    // First find all user tasks that are completed
    const userTasks = await UserTaskModel.find({
      user: patient,
      completed: true,
    })

    const user = await UserModel.findById(patient)
    // For each completed tasks group tasks by task
    const groupedTasks: any = userTasks.reduce((acc: any, task: any) => {
      const taskGroup = acc[task.task] || []
      taskGroup.push(task)
      acc[task.task] = taskGroup
      return acc
    }, {})
    // For each task group, find two most recent tasks to today. The first task should be the currentTask and the second task should be the previousTask
    const tasks = Object.keys(groupedTasks).map((taskName: string) => {
      const taskGroup = groupedTasks[taskName]
      const sortedTasks = taskGroup.sort((a: any, b: any) => {
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
    // const score = calculateScore(lastTask, userTask, task.type)

    const scorePromises = tasks.map(async (task: any) => {
      const taskType = await TaskModel.findById(task.currentTask.task)
      if (taskType) {
        return calculateScore(
          task.previousTask,
          task.currentTask,
          taskType.type
        )
      }
    })

    try {
      const scores = await Promise.all(scorePromises)
      // remove duplicate scores by date match using date-fns however somes score won't have anything to compare to so we need to filter out undefined
      const uniqueScores = scores.filter((score) => score).filter(
        (score, index, self) =>
          index ===
          self.findIndex(
            (s) =>
              s.date.getTime() === score.date.getTime() &&
              s.task === score.task
          )
      )

      // add new scores to user score array
      user.score.push(...uniqueScores.filter((score) => score))
      await user.save()
      return uniqueScores
    } catch (err) {
      console.log("error calculating score: ", err)
    }
  } catch (error) {
    console.log(error, "error calculating score")
  }
}

import { calculateScore } from "../PROAnalysis";
import { UserTaskModel } from "../schema/task.user.schema";
import { User, UserModel } from "../schema/user.schema";

export async function calculatePatientScores(patient: User) {
    // First find all user tasks that are completed
    const userTasks = await UserTaskModel.find({ user: patient._id, completed: true });
    const user = await UserModel.findById(patient?._id)
    // For each completed tasks group tasks by task
    const groupedTasks = userTasks.reduce((acc: any, task: any) => {
        const taskGroup = acc[task.task] || []
        taskGroup.push(task);
        acc[task.task] = taskGroup
        return acc
    }, {})
    // For each task group, find two most recent tasks to today. The first task should be the currentTask and the second task should be the previousTask
    const tasks = Object.keys(groupedTasks).map((task: any) => {
        const sortedTasks = groupedTasks[task].sort((a: any, b: any) => {
            return a.completedAt - b.completedAt
        })
        const currentTask = sortedTasks[sortedTasks.length - 1]
        const previousTask = sortedTasks[sortedTasks.length - 2]
        return { currentTask, previousTask }
    });
    // For each task, calculate the score by using the calculateScore function
    // const score = calculateScore(lastTask, userTask, task.type)

    const score = tasks.map((task: any) => {
        return calculateScore(task.previousTask, task.currentTask, task.currentTask.task.type);

    })
    // push the score onto the user score array
    if (score !== null) {
        user.score.push(score)
        await user.save()
    }
}
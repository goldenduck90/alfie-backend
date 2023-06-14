import { UserTask, UserTaskModel } from "./../schema/task.user.schema"
// get all userTasks that are completed from the UserTaskModel and group them by task
// const hungerPercentile: any = {
//   45: "25th",
//   64: "50th",
//   83: "75th",
//   100: "90-95th",
// }
function calculateSingleMPHunger(currentTask: UserTask) {
  console.log(currentTask, "currentTask")
  const currentHungerLevel1Hour = Number(
    currentTask.answers.find((answer) => answer.key === "hungerLevel1Hour")
      ?.value
  )

  const currentHungerLevel30Mins = Number(
    currentTask.answers.find((answer) => answer.key === "hungerLevel30Mins")
      ?.value
  )
  // const score = currentHungerLevel1Hour - currentHungerLevel30Mins
  // const increased = score > 0
  // const message = `Your hunger level has ${
  //   increased ? "increased" : "decreased"
  // } by ${score}`
  // const percentile1hour =
  //   currentHungerLevel1Hour <= 45
  //     ? "25"
  //     : currentHungerLevel1Hour <= 64
  //     ? "50"
  //     : currentHungerLevel1Hour <= 83
  //     ? "75"
  //     : currentHungerLevel1Hour <= 100
  //     ? "90"
  //     : "95"
  // const percentile30mins =
  //   currentHungerLevel30Mins <= 45
  //     ? "25"
  //     : currentHungerLevel30Mins <= 64
  //     ? "50"
  //     : currentHungerLevel30Mins <= 83
  //     ? "75"
  //     : currentHungerLevel30Mins <= 100
  //     ? "90"
  //     : "95"
  return {
    twoHour: Number(currentHungerLevel1Hour),
    thirtyMins: Number(currentHungerLevel30Mins),
  }
}
export async function calculateAllScores() {
  try {
    const allTasks = await UserTaskModel.find({
      completed: true,
      task: "63101dac2e5d526709a509bd",
    })
    // console.log(allTasks, "allTasks")
    // calculate the score for each task
    const scores = allTasks.map((task) => {
      return calculateSingleMPHunger(task)
    })
    console.log(JSON.stringify(scores))
    return allTasks
  } catch (e) {
    console.log(e)
  }
}

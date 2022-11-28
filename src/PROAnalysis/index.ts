import { TaskType } from "./../schema/task.schema"
import { UserTask } from "./../schema/task.user.schema"
// In our database our patients have PRO aka Patient Reported Outcomes. We call these Tasks.
// Tasks get set to a patient on an interval basis and the patient is asked to complete the task.
// We get these results and we save them as a UserTask
// At the time that the task is submitted we will call a calculate function to calculate the score which will be a percent difference between the last PRO and the current PRO
// We want to take this result and store it on the user as an object where the key is the task name and the value is the score (percent difference) we will also store the date of the scoring so we can graph it

function calculateScore(
  lastTask: UserTask,
  currentTask: UserTask,
  taskType: TaskType
) {
  // Each UserTask has answers we need to review each answer for each TaskType and calculate the score
  // Each TaskType has a different scoring method so we need to check the type of the task and then calculate the score based on the type

  // If this is the first time the user is submitting a task then we will just return 0

  console.log(lastTask, "lastTask")
  console.log(currentTask, "currentTask")
  console.log(taskType, "taskType")
  if (!lastTask) {
    return null
  }
  const lastAnswers = lastTask.answers
  const currentAnswers = currentTask.answers
  const currentDate = new Date()
  let percent = 0
  let increased = false
  const scoreObj = {
    percent: 0,
    increased: false,
    date: currentDate,
  }
  // We need to check the type of the task and then calculate the score based on the type
  if (
    taskType === TaskType.MP_ACTIVITY ||
    taskType === TaskType.WEIGHT_LOG ||
    taskType === TaskType.WAIST_LOG
  ) {
    // MP_ACTIVITY is a users recorded steps which is a Number so we can just take the percent difference between the last and current
    // We need to check if the lastTask is null because this is the first time the user is submitting a task
    if (lastTask) {
      // Answers follow this structure: [{"key": "steps", "value": "12000", "type": "DATE"}]
      percent =
        Math.abs(
          (Number(currentAnswers[0].value) - Number(lastAnswers[0].value)) /
            Number(currentAnswers[0].value)
        ) * 100
      increased = Number(currentAnswers[0].value) > Number(lastAnswers[0].value)
      scoreObj.percent = percent
      scoreObj.increased = increased
      return scoreObj
    } else {
      // If this is the first time the user is submitting a task then we will just return 0
      // Alert should go our if the SD changes by 1% or more
      return scoreObj
    }
  }

  if (taskType === TaskType.BP_LOG) {
    // BP_LOG is a users recorded blood pressure which is a String so we need to parse the string and then take the percent difference between the last and current
    // We need to check if the lastTask is null because this is the first time the user is submitting a task
    if (lastTask) {
      // Answers follow this structure: [{"key": "systolic", "value": "120", "type": "NUMBER"}, {"key": "diastolic", "value": "80", "type": "NUMBER"}]
      const currentSystolic = Number(currentAnswers[0].value)
      const currentDiastolic = Number(currentAnswers[1].value)
      const lastSystolic = Number(lastAnswers[0].value)
      const lastDiastolic = Number(lastAnswers[1].value)
      percent =
        Math.abs(currentSystolic - lastSystolic) +
        Math.abs(currentDiastolic - lastDiastolic) / currentSystolic +
        currentDiastolic * 100
      increased =
        currentSystolic > lastSystolic && currentDiastolic > lastDiastolic
      // Median of both last and curernt and then take the percent difference
      scoreObj.percent = percent
      scoreObj.increased = increased
      return scoreObj
    }
  }
  // MP_FEELING gets recorded like this: // [{"key": "tenseLevel", "value": "Most of the time", "type": "STRING"}, {"key": "frightenedLevel", "value": "Yes, but not too badly", "type": "STRING"}, {"key": "easeFrequency", "value": "Not Often", "type": "STRING"}, {"key": "worryAmount", "value": "From time to time, but not too often", "type": "STRING"}, {"key": "frightenedFrequency", "value": "Quite Often", "type": "STRING"}, {"key": "restlessAmount", "value": "Quite a lot", "type": "STRING"}, {"key": "panicFrequency", "value": "Not very often", "type": "STRING"}]
  // We need to assign a number to each answer based upon it's key and then add up the total score
  // once we have the total score for each key for the last task and current task we will need to find the perfect difference between the two
  if (taskType === TaskType.MP_FEELING) {
    // We need to check if the lastTask is null because this is the first time the user is submitting a task
    if (lastTask) {
      type ObjectType = {
        [key: string]: number
      }
      const tenseLevel: ObjectType = {
        "Not at all": 0,
        "From time to time, occasionally": 1,
        "Some of the time": 2,
        "Most of the time": 3,
      }
      const frightenedLevel: ObjectType = {
        "Not at all": 0,
        "A little, but it doesn't worry me": 1,
        "Yes, but not too badly": 2,
        "Very definitely and quite badly": 0,
      }
      const easeFrequency: ObjectType = {
        "Only occasionally": 0,
        "From time to time, but not too often": 1,
        "A lot of the time": 2,
        "A great deal of the time ": 3,
      }
      const worryAmount: ObjectType = {
        "Definitely": 0,
        "Usually": 1,
        "Not Often": 2,
        "Not at all": 3,
      }
      const frightenedFrequency: ObjectType = {
        "Not at all": 0,
        "Occasionally": 1,
        "Quite Often": 2,
        "Very Often": 3,
      }
      const restlessAmount: ObjectType = {
        "Not at all": 0,
        "Not very much": 1,
        "Quite a lot": 2,
        "Very much indeed": 3,
      }
      const panicFrequency: ObjectType = {
        "Not at all": 0,
        "Not very often": 1,
        "Quite often": 2,
        "Very often indeed": 3,
      }
      const currentTenseLevel =
        tenseLevel[
          currentAnswers.find((answer) => answer.key === "tenseLevel").value
        ]
      const currentFrightenedLevel = frightenedLevel[currentAnswers[1].value]
      const currentEaseFrequency = easeFrequency[currentAnswers[2].value]
      const currentWorryAmount = worryAmount[currentAnswers[3].value]
      const currentFrightenedFrequency =
        frightenedFrequency[currentAnswers[4].value]
      const currentRestlessAmount = restlessAmount[currentAnswers[5].value]
      const currentPanicFrequency = panicFrequency[currentAnswers[6].value]
      const lastTenseLevel = tenseLevel[lastAnswers[0].value]
      const lastFrightenedLevel = frightenedLevel[lastAnswers[1].value]
      const lastEaseFrequency = easeFrequency[lastAnswers[2].value]
      const lastWorryAmount = worryAmount[lastAnswers[3].value]
      const lastFrightenedFrequency = frightenedFrequency[lastAnswers[4].value]
      const lastRestlessAmount = restlessAmount[lastAnswers[5].value]
      const lastPanicFrequency = panicFrequency[lastAnswers[6].value]
      const score =
        Math.abs(currentTenseLevel - lastTenseLevel) +
        Math.abs(currentFrightenedLevel - lastFrightenedLevel) +
        Math.abs(currentEaseFrequency - lastEaseFrequency) +
        Math.abs(currentWorryAmount - lastWorryAmount) +
        Math.abs(currentFrightenedFrequency - lastFrightenedFrequency) +
        Math.abs(currentRestlessAmount - lastRestlessAmount) +
        Math.abs(currentPanicFrequency - lastPanicFrequency)
      const total =
        currentTenseLevel +
        currentFrightenedLevel +
        currentEaseFrequency +
        currentWorryAmount +
        currentFrightenedFrequency +
        currentRestlessAmount +
        currentPanicFrequency
      percent = (score / total) * 100
      increased =
        currentTenseLevel > lastTenseLevel &&
        currentFrightenedLevel > lastFrightenedLevel &&
        currentEaseFrequency > lastEaseFrequency &&
        currentWorryAmount > lastWorryAmount &&
        currentFrightenedFrequency > lastFrightenedFrequency &&
        currentRestlessAmount > lastRestlessAmount &&
        currentPanicFrequency > lastPanicFrequency
      scoreObj.percent = percent
      scoreObj.increased = increased
      return scoreObj
    } else {
      // If this is the first time the user is submitting a task then we will just return 0
      return scoreObj
    }
  }
  if (taskType === TaskType.MP_HUNGER) {
    // [{"key": "foodEaten", "value": "mushrooms and rice", "type": "STRING"}, {"key": "hungerLevel1Hour", "value": "65", "type": "DATE"}, {"key": "hungerLevel30Mins", "value": "32", "type": "DATE"}]

    const currentHungerLevel1Hour = currentAnswers.find(
      (answer) => answer.key === "hungerLevel1Hour"
    ).value
    const lastHungerLevel1Hour = lastAnswers.find(
      (answer) => answer.key === "hungerLevel1Hour"
    ).value
    const currentHungerLevel30Min = currentAnswers.find(
      (answer) => answer.key === "hungerLevel30Mins"
    ).value
    const lastHungerLevel30Min = lastAnswers.find(
      (answer) => answer.key === "hungerLevel30Mins"
    ).value
    percent =
      Math.abs(Number(currentHungerLevel1Hour) - Number(lastHungerLevel1Hour)) +
      Math.abs(Number(currentHungerLevel30Min) - Number(lastHungerLevel30Min)) /
        Number(currentHungerLevel1Hour) +
      Number(currentHungerLevel30Min) * 100
    increased =
      Number(currentHungerLevel1Hour) > Number(lastHungerLevel1Hour) &&
      Number(currentHungerLevel30Min) > Number(lastHungerLevel30Min)
    scoreObj.percent = percent
    scoreObj.increased = increased
    return scoreObj
  }

  return scoreObj
}

export { calculateScore }

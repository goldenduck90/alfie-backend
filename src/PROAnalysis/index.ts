import { TaskType } from "../schema/task.schema"
import { UserTask } from "../schema/task.user.schema"
import { mpFeelingQuestions } from "./questions"

function getPercentageChange(oldNumber: number, newNumber: number) {
  const decreaseValue = oldNumber - newNumber

  return Math.abs(Math.round((decreaseValue / oldNumber) * 100))
}
const hadspercentile: any = {
  2: "25th",
  3: "50th",
  5: "75th",
  6: "90th",
  10: "95th",
}
const stepsPercentile: any = {
  3000: "25th",
  3375: "50th",
  9000: "75th",
  11000: "90th",
  12000: "95th",
}
const hungerPercentile: any = {
  45: "25th",
  64: "50th",
  83: "75th",
  100: "90-95th",
}
// We will take the current score and compare it to the median and calculate the percent difference
// If the score is greater than the median we will calculate the percent difference between the score and the median
// If the score is less than the median we will calculate the percent difference between the median and the score
// We will then store this value on the user as an object where the key is the task name and the value is the score (percent difference) we will also store the date of the scoring so we can graph it
// For example:
// {
//   "HADS A": {
//     "score": 0.5,
//     "date": "2020-01-01"
//   }
// }

// We also need to store if the patient for that task has increased or decreased since the last time they took the task.
// For example:
// {
//   "HADS A": {
//     "score": 0.5,
//     "date": "2020-01-01",
//     "increased": true
//   }
// }

// We also need to store the percent difference between the current score and the last score total
// For example:
// {
//   "HADS A": {
//     "score": 0.5,
//     "date": "2020-01-01",
//     "increased": true,
//     "percentDifference": 0.5
//     "message": "You scored within the 50th percentile"
//   }
// }
// mpFeelingQuestions is of type:
// type QuestionType = {
//     [key: string]: {
//         [key: string]: number
//     }
// }
function calculateMPFeelingScore(
  lastTask: UserTask,
  currentTask: UserTask,
  task: TaskType
) {
  // We first need to create a score for the lastTask and the currentTask
  // We will create a score for task in it's entirety all the scores added together for each question will equal the score for the task

  const lastTaskScore = Object.keys(lastTask.answers).reduce(
    (acc, key: any) => {
      const answer: any = lastTask.answers[key]
      const score = mpFeelingQuestions[answer.key][answer.value]
      return acc + score
    },
    0
  )

  const currentTaskScore = Object.keys(currentTask.answers).reduce(
    (acc, key: any) => {
      const answer: any = currentTask.answers[key]
      const score = mpFeelingQuestions[answer.key][answer.value]
      return acc + score
    },
    0
  )

  const score = currentTaskScore - lastTaskScore
  const percentDifferenceBetweenLastAndCurrentTaskScore = getPercentageChange(
    lastTaskScore,
    currentTaskScore
  )
  const increased = score > 0
  const percentileKey = Object.keys(hadspercentile).reduce((acc, key) => {
    const value = parseInt(key)
    if (value < currentTaskScore) {
      return hadspercentile[value]
    }
    return acc
  }, 0)
  const message = `You scored within the ${percentileKey} percentile`
  return {
    score,
    date: currentTask.completedAt,
    increased,
    percentDifference: percentDifferenceBetweenLastAndCurrentTaskScore,
    message,
    task,
  }
}
function calculateActivityScore(
  lastTask: UserTask,
  currentTask: UserTask,
  task: TaskType
) {
  // The tasks in this category are all activity based tasks so their values for each task are simple numbers
  // For Example: [{"key": "weight", "value": "333", "type": "DATE"}]
  const lastTaskScore = Number(lastTask.answers[0].value)
  const currentTaskScore = Number(currentTask.answers[0].value)
  const score = currentTaskScore - lastTaskScore
  const percentDifferenceBetweenLastAndCurrentTaskScore = getPercentageChange(
    lastTaskScore,
    currentTaskScore
  )
  const increased = currentTaskScore > lastTaskScore
  if (task === TaskType.MP_ACTIVITY) {
    const percentileDifferenceStepsPercentile = Object.keys(
      stepsPercentile
    ).reduce((acc, key) => {
      const value = parseInt(key)
      if (value < currentTaskScore) {
        return stepsPercentile[value]
      } else if (value === currentTaskScore) {
        return stepsPercentile[value]
      } else if (value > currentTaskScore) {
        return acc
      }
      return acc
    }, 0)
    const message = `You scored within the ${percentileDifferenceStepsPercentile} percentile`
    return {
      score,
      date: currentTask.completedAt,
      increased,
      percentDifference: percentDifferenceBetweenLastAndCurrentTaskScore,
      message,
      task,
    }
  }
  if (task === TaskType.WEIGHT_LOG) {
    const message = `Your weight has ${
      increased ? "increased" : "decreased"
    } by ${percentDifferenceBetweenLastAndCurrentTaskScore}%`
    return {
      score,
      date: currentTask.completedAt,
      increased,
      percentDifference: percentDifferenceBetweenLastAndCurrentTaskScore,
      message,
      task,
    }
  }
  if (task === TaskType.WAIST_LOG) {
    const message = `Your waist has ${
      increased ? "increased" : "decreased"
    } by ${percentDifferenceBetweenLastAndCurrentTaskScore}%`
    return {
      score,
      date: currentTask.completedAt,
      increased,
      percentDifference: percentDifferenceBetweenLastAndCurrentTaskScore,
      message,
      task,
    }
  }
}
function calculateHungerScore(
  lastTask: UserTask,
  currentTask: UserTask,
  task: TaskType
) {
  // [{"key": "foodEaten", "value": "mushrooms and rice", "type": "STRING"}, {"key": "hungerLevel1Hour", "value": "65", "type": "DATE"}, {"key": "hungerLevel30Mins", "value": "32", "type": "DATE"}]
  const currentHungerLevel1Hour = Number(
    currentTask.answers.find((answer) => answer.key === "hungerLevel1Hour")
      .value
  )
  const currentHungerLevel30Mins = Number(
    currentTask.answers.find((answer) => answer.key === "hungerLevel30Mins")
      .value
  )
  const lastHungerLevel1Hour = Number(
    lastTask.answers.find((answer) => answer.key === "hungerLevel1Hour").value
  )
  const lastHungerLevel30Mins = Number(
    lastTask.answers.find((answer) => answer.key === "hungerLevel30Mins").value
  )
  const currentHungerLevel1HourPercentDifference = getPercentageChange(
    lastHungerLevel1Hour,
    currentHungerLevel1Hour
  )
  const currentHungerLevel30MinsPercentDifference = getPercentageChange(
    lastHungerLevel30Mins,
    currentHungerLevel30Mins
  )
  const percentileDifferenceHungerPercentile1hour = Object.keys(
    hungerPercentile
  ).reduce((acc, key) => {
    const value = parseInt(key)
    if (value < currentHungerLevel1Hour) {
      return hungerPercentile[value]
    } else if (value === currentHungerLevel1Hour) {
      return hungerPercentile[value]
    } else if (value > currentHungerLevel1Hour) {
      return acc
    }
    return acc
  }, 0)
  const percentileDifferenceHungerPercentile30mins = Object.keys(
    hungerPercentile
  ).reduce((acc, key) => {
    const value = parseInt(key)
    if (value < currentHungerLevel30Mins) {
      return hungerPercentile[value]
    } else if (value === currentHungerLevel30Mins) {
      return hungerPercentile[value]
    } else if (value > currentHungerLevel30Mins) {
      return acc
    }
    return acc
  }, 0)

  const increased1Hour = currentHungerLevel1Hour > lastHungerLevel1Hour
  const increased30Mins = currentHungerLevel30Mins > lastHungerLevel30Mins
  const message = `Your hunger level has ${
    increased1Hour ? "increased" : "decreased"
  } by ${currentHungerLevel1HourPercentDifference}% for 1 hour and ${
    increased30Mins ? "increased" : "decreased"
  } by ${currentHungerLevel30MinsPercentDifference}% for 30 mins and you scored within the ${percentileDifferenceHungerPercentile1hour} percentile for 1 hour and ${percentileDifferenceHungerPercentile30mins} percentile for 30 mins`
  return {
    score1hour: currentHungerLevel1HourPercentDifference,
    score30mins: currentHungerLevel30MinsPercentDifference,
    date: currentTask.completedAt,
    increased1Hour,
    increased30Mins,
    percentDifference1Hour: currentHungerLevel1HourPercentDifference,
    percentDifference30Mins: currentHungerLevel30MinsPercentDifference,
    message,
    task,
  }
}
function calculateBPLogScore(
  lastTask: UserTask,
  currentTask: UserTask,
  task: TaskType
) {
  // // Answers follow this structure: [{"key": "systolic", "value": "120", "type": "NUMBER"}, {"key": "diastolic", "value": "80", "type": "NUMBER"}]
  // If systolic is > 140 or diastolic is > 90, go to next highest category. If above 130/80, ask if they are taking htn drugs.
  // If it ever hit systolic > 140, diastolic >90, must stop phentermine/bupropion, doctor to independantly review if they are taking htn drugs.
  // For geriatrics, if systolic is >130 and diastolic > 80, cannot be prescribed bupropion or phentermine
  const currentSystolic = Number(
    currentTask.answers.find((answer) => answer.key === "systolicBp").value
  )
  const currentDiastolic = Number(
    currentTask.answers.find((answer) => answer.key === "diastolicBp").value
  )
  const lastSystolic = Number(
    lastTask.answers.find((answer) => answer.key === "systolicBp").value
  )
  const lastDiastolic = Number(
    lastTask.answers.find((answer) => answer.key === "diastolicBp").value
  )
  const currentSystolicPercentDifference = getPercentageChange(
    lastSystolic,
    currentSystolic
  )
  const currentDiastolicPercentDifference = getPercentageChange(
    lastDiastolic,
    currentDiastolic
  )
  const increasedSystolic = currentSystolic > lastSystolic
  const increasedDiastolic = currentDiastolic > lastDiastolic
  const message = `Your systolic has ${
    increasedSystolic ? "increased" : "decreased"
  } by ${currentSystolicPercentDifference}% and your diastolic has ${
    increasedDiastolic ? "increased" : "decreased"
  } by ${currentDiastolicPercentDifference}%`
  let providerMessage = ""
  switch (true) {
    case currentSystolic > 140 || currentDiastolic > 90:
      providerMessage =
        "Your systolic is > 140 or diastolic is > 90, go to next highest category. If above 130/80, ask if they are taking htn drugs."
      break
    case currentSystolic > 130 && currentDiastolic > 80:
      providerMessage =
        "For geriatrics, if systolic is >130 and diastolic > 80, cannot be prescribed bupropion or phentermine"
      break
    default:
      break
  }
  // const providerMessage =
  return {
    scoreSystolic: currentSystolicPercentDifference,
    scoreDiastolic: currentDiastolicPercentDifference,
    date: currentTask.completedAt,
    increasedSystolic,
    increasedDiastolic,
    percentDifferenceSystolic: currentSystolicPercentDifference,
    percentDifferenceDiastolic: currentDiastolicPercentDifference,
    message,
    task,
    providerMessage,
  }
}
export function calculateScore(
  lastTask: UserTask,
  currentTask: UserTask,
  taskType: TaskType
) {
  if (taskType === TaskType.MP_FEELING) {
    return calculateMPFeelingScore(lastTask, currentTask, taskType)
  }
  if (
    taskType === TaskType.MP_ACTIVITY ||
    taskType === TaskType.WEIGHT_LOG ||
    taskType === TaskType.WAIST_LOG
  ) {
    return calculateActivityScore(lastTask, currentTask, taskType)
  }
  if (taskType === TaskType.MP_HUNGER) {
    return calculateHungerScore(lastTask, currentTask, taskType)
  }
  if (taskType === TaskType.BP_LOG) {
    return calculateBPLogScore(lastTask, currentTask, taskType)
  }
  return null
}

import { TaskType } from "../schema/task.schema"
import { Score } from "../schema/user.schema"
import {
  UserAnswer,
  UserAnswerTypes,
  UserTask,
} from "../schema/task.user.schema"
import AnswerType from "../schema/enums/AnswerType"
import { gsrsQuestions, mpFeelingQuestions, tefqQuestions } from "./questions"

function getPercentageChange(oldNumber: number, newNumber: number) {
  const decreaseValue = oldNumber - newNumber
  return Math.abs(Math.round((decreaseValue / oldNumber) * 100))
}

const hadsPercentile: Record<number, string> = {
  2: "25th",
  3: "50th",
  5: "75th",
  6: "90th",
  10: "95th",
}

const stepsPercentile: Record<number, string> = {
  3000: "25th",
  3375: "50th",
  9000: "75th",
  11000: "90th",
  12000: "95th",
}
const hungerPercentile: Record<number, string> = {
  45: "25th",
  64: "50th",
  83: "75th",
  100: "95th",
}

function getZPercent(z: number) {
  // z == number of standard deviations from the mean

  // if z is greater than 6.5 standard deviations from the mean the
  // number of significant digits will be outside of a reasonable range

  if (z < -6.5) {
    return 0.0
  }

  if (z > 6.5) {
    return 1.0
  }

  let factK = 1
  let sum = 0
  let term = 1
  let k = 0
  const loopStop = Math.exp(-23)

  while (Math.abs(term) > loopStop) {
    term =
      (((0.3989422804 * Math.pow(-1, k) * Math.pow(z, k)) /
        (2 * k + 1) /
        Math.pow(2, k)) *
        Math.pow(z, k + 1)) /
      factK
    sum += term
    k++
    factK *= k
  }

  sum += 0.5

  return sum
}

/** zScore is  `(score - mean) / standard deviation` */
function getZScore(score: number, mean: number, sd: number) {
  return (score - mean) / sd
}

function calculateMPFeelingScore(
  lastTask: UserTask,
  currentTask: UserTask,
  task: TaskType
): Score {
  // We first need to create a score for the lastTask and the currentTask
  // We will create a score for task in it's entirety all the scores added together for each question will equal the score for the task

  const lastTaskScore = answersReductionCalculation(
    lastTask.answers,
    mpFeelingQuestions
  )
  const currentTaskScore = answersReductionCalculation(
    currentTask.answers,
    mpFeelingQuestions
  )

  const score = currentTaskScore - lastTaskScore
  const percentDifferenceBetweenLastAndCurrentTaskScore = getPercentageChange(
    lastTaskScore,
    currentTaskScore
  )
  const increased = score > 0
  const percentileKey = getHadsPercentile(currentTaskScore)
  const message = `You scored within the ${percentileKey} percentile`
  const calculatedZScore = getZScore(currentTaskScore, 3.9, 3.1)
  const calculatedPercentile = getZPercent(calculatedZScore) * 100

  return {
    percentile: String(percentileKey),
    latest: String(currentTaskScore),
    score,
    calculatedPercentile,
    date: currentTask.completedAt,
    increased,
    percentDifference: isFinite(percentDifferenceBetweenLastAndCurrentTaskScore)
      ? percentDifferenceBetweenLastAndCurrentTaskScore
      : 0,
    message,
    task,
  }
}
function calculateSingleMPFeeling(
  currentTask: UserTask,
  task: TaskType
): Score {
  const currentTaskScore = answersReductionCalculation(
    currentTask.answers,
    mpFeelingQuestions
  )

  // Add a check for currentTaskScore being a valid number
  if (isNaN(currentTaskScore)) {
    console.warn("Invalid currentTaskScore for MP_FEELING:", currentTaskScore)
    return null
  }

  const percentileKey = getHadsPercentile(currentTaskScore)

  const message = `You scored within the ${percentileKey} percentile`
  const calculatedZScore = getZScore(currentTaskScore, 3.9, 3.1)
  const calculatedPercentile = getZPercent(calculatedZScore) * 100

  return {
    percentile: String(percentileKey),
    calculatedPercentile,
    latest: String(currentTaskScore),
    date: currentTask.completedAt,
    message,
    task,
  }
}

function calculateActivityScore(
  lastTask: UserTask,
  currentTask: UserTask,
  task: TaskType
): Score {
  // The tasks in this category are all activity based tasks so their values for each task are simple numbers
  // For Example: [{"key": "weight", "value": "333", "type": "DATE"}]
  const lastTaskScore = Number(lastTask?.answers[0]?.value)
  const currentTaskScore = Number(currentTask?.answers[0]?.value)

  if (!lastTaskScore || !currentTaskScore) {
    return {} as Score // TODO use a null value instead for type guarantees
  }

  const score = currentTaskScore - lastTaskScore
  const percentDifferenceBetweenLastAndCurrentTaskScore = getPercentageChange(
    lastTaskScore,
    currentTaskScore
  )
  const increased = currentTaskScore > lastTaskScore
  if (task === TaskType.MP_ACTIVITY) {
    const percentileDifferenceStepsPercentile =
      getStepsPercentile(currentTaskScore)

    const message = `You scored within the ${percentileDifferenceStepsPercentile} percentile`
    return {
      latest: String(currentTaskScore),
      score,
      date: currentTask.completedAt,
      increased,
      percentDifference: percentDifferenceBetweenLastAndCurrentTaskScore,
      message,
      task,
      percentile: String(percentileDifferenceStepsPercentile),
    }
  }
  if (task === TaskType.WEIGHT_LOG) {
    const message = `Your weight has ${
      increased ? "increased" : "decreased"
    } by ${percentDifferenceBetweenLastAndCurrentTaskScore}%`
    return {
      latest: String(currentTaskScore ?? ""),
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
      latest: String(currentTaskScore ?? ""),
      score,
      date: currentTask.completedAt,
      increased,
      percentDifference: percentDifferenceBetweenLastAndCurrentTaskScore,
      message,
      task,
    }
  }
}

function calculateSingleMPActivity(
  currentTask: UserTask,
  task: TaskType
): Score {
  const currentTaskScore = Number(currentTask.answers[0]?.value)
  const percentileDifferenceStepsPercentile =
    getStepsPercentile(currentTaskScore)

  const message = `You scored within the ${percentileDifferenceStepsPercentile} percentile`
  return {
    // calculatedPercentile,
    latest: String(currentTaskScore),
    date: currentTask.completedAt,
    message,
    task,
    percentile: String(percentileDifferenceStepsPercentile),
  }
}
function calculateSingleMPHunger(currentTask: UserTask, task: TaskType): Score {
  const currentHungerLevel1Hour = getAnswerByKey(
    currentTask.answers,
    "hungerLevel1Hour",
    Number
  )
  const currentHungerLevel30Mins = getAnswerByKey(
    currentTask.answers,
    "hungerLevel30Mins",
    Number
  )

  const percentile1hour = getHungerPercentile(currentHungerLevel1Hour)
  const percentile30mins = getHungerPercentile(currentHungerLevel30Mins)

  return {
    percentile1hour: String(percentile1hour),
    percentile30mins: String(percentile30mins),
    latest: String(currentHungerLevel1Hour),
    date: currentTask.completedAt,
    task,
  }
}

function calculateHungerScore(
  lastTask: UserTask,
  currentTask: UserTask,
  task: TaskType
): Score {
  // [{"key": "foodEaten", "value": "mushrooms and rice", "type": "STRING"}, {"key": "hungerLevel1Hour", "value": "65", "type": "DATE"}, {"key": "hungerLevel30Mins", "value": "32", "type": "DATE"}]
  if (!lastTask || !currentTask) {
    return {} as Score // TODO use null
  }
  const currentHungerLevel1Hour = getAnswerByKey(
    currentTask.answers,
    "hungerLevel1Hour",
    Number
  )
  const currentHungerLevel30Mins = getAnswerByKey(
    currentTask.answers,
    "hungerLevel30Mins",
    Number
  )
  const lastHungerLevel1Hour = getAnswerByKey(
    lastTask.answers,
    "hungerLevel1Hour",
    Number
  )
  const lastHungerLevel30Mins = getAnswerByKey(
    lastTask.answers,
    "hungerLevel30Mins",
    Number
  )

  const currentHungerLevel1HourPercentDifference = getPercentageChange(
    lastHungerLevel1Hour,
    currentHungerLevel1Hour
  )
  const currentHungerLevel30MinsPercentDifference = getPercentageChange(
    lastHungerLevel30Mins,
    currentHungerLevel30Mins
  )
  const percentileDifferenceHungerPercentile1hour =
    getHungerDifferencePercentile(currentHungerLevel1Hour)
  const percentileDifferenceHungerPercentile30mins =
    getHungerDifferencePercentile(currentHungerLevel30Mins)

  const increased1hour = currentHungerLevel1Hour > lastHungerLevel1Hour
  const increased30Mins = currentHungerLevel30Mins > lastHungerLevel30Mins
  const message = `Your hunger level has ${
    increased1hour ? "increased" : "decreased"
  } by ${currentHungerLevel1HourPercentDifference}% for 1 hour and ${
    increased30Mins ? "increased" : "decreased"
  } by ${currentHungerLevel30MinsPercentDifference}% for 30 mins and you scored within the ${percentileDifferenceHungerPercentile1hour} percentile for 1 hour and ${percentileDifferenceHungerPercentile30mins} percentile for 30 mins`
  const score1hourIsFinite = isFinite(currentHungerLevel1HourPercentDifference)
    ? currentHungerLevel1HourPercentDifference
    : 0
  const score30minsIsFinite = isFinite(
    currentHungerLevel30MinsPercentDifference
  )
    ? currentHungerLevel30MinsPercentDifference
    : 0
  const percentDifference1HourIsFinite = isFinite(
    currentHungerLevel1HourPercentDifference
  )
    ? currentHungerLevel1HourPercentDifference
    : 0
  const percentDifference30MinsIsFinite = isFinite(
    currentHungerLevel30MinsPercentDifference
  )
    ? currentHungerLevel30MinsPercentDifference
    : 0
  // 25 %	45
  // 50 % 64
  // 75 % 83
  // 90 % 100
  // 95 % 100
  const percentile1hour = getHungerPercentile(
    percentileDifferenceHungerPercentile1hour
  )
  const percentile30mins = getHungerPercentile(
    percentileDifferenceHungerPercentile30mins
  )

  const calculatedZScore1hour = getZScore(currentHungerLevel1Hour, 64, 28.1)
  const calculatedZScore30mins = getZScore(currentHungerLevel30Mins, 64, 28.1)
  const calculated1hourPercent = getZPercent(calculatedZScore1hour) * 100
  const calculated30minsPercent = getZPercent(calculatedZScore30mins) * 100
  return {
    calculated1hourPercent,
    calculated30minsPercent,
    percentile1hour: String(percentile1hour),
    percentile30mins: String(percentile30mins),
    latest: `2 hour: ${currentHungerLevel1Hour}, 30 mins: ${currentHungerLevel30Mins}`,
    score1hour: String(score1hourIsFinite),
    score30mins: String(score30minsIsFinite),
    date: currentTask.completedAt,
    increased1hour,
    increased30Mins,
    percentDifference1Hour: percentDifference1HourIsFinite,
    percentDifference30Mins: percentDifference30MinsIsFinite,
    message,
    task,
  }
}

function calculateBPLogScore(
  lastTask: UserTask,
  currentTask: UserTask,
  task: TaskType
): Score {
  // // Answers follow this structure: [{"key": "systolic", "value": "120", "type": "NUMBER"}, {"key": "diastolic", "value": "80", "type": "NUMBER"}]
  // If systolic is > 140 or diastolic is > 90, go to next highest category. If above 130/80, ask if they are taking htn drugs.
  // If it ever hit systolic > 140, diastolic >90, must stop phentermine/bupropion, doctor to independantly review if they are taking htn drugs.
  // For geriatrics, if systolic is >130 and diastolic > 80, cannot be prescribed bupropion or phentermine

  const currentSystolic = getAnswerByKey(
    currentTask.answers,
    "systolicBp",
    Number
  )
  const currentDiastolic = getAnswerByKey(
    currentTask.answers,
    "diastolicBp",
    Number
  )
  const lastSystolic = getAnswerByKey(lastTask.answers, "systolicBp", Number)
  const lastDiastolic = getAnswerByKey(lastTask.answers, "diastolicBp", Number)

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

  return {
    latest: `${currentSystolic}/${currentDiastolic}`,
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

function calculateSingleBPLog(currentTask: UserTask, task: TaskType): Score {
  const currentSystolic = getAnswerByKey(
    currentTask.answers,
    "systolicBp",
    Number
  )
  const currentDiastolic = getAnswerByKey(
    currentTask.answers,
    "diastolicBp",
    Number
  )

  const message = `Your systolic is ${currentSystolic} and your diastolic is ${currentDiastolic}`
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
  return {
    latest: `${currentSystolic}/${currentDiastolic}`,
    date: currentTask.completedAt,
    message,
    task,
    providerMessage,
  }
}

function calculateGsrs(
  lastTask: UserTask,
  currentTask: UserTask,
  task: TaskType
): Score {
  // lastTask.answers is an array of objects and each object has a key and value
  const lastGsrs = answersReductionCalculation(lastTask.answers, gsrsQuestions)
  const currentGsrs = answersReductionCalculation(
    currentTask.answers,
    gsrsQuestions
  )

  const currentGsrsPercentDifference = getPercentageChange(
    lastGsrs,
    currentGsrs
  )
  const increased = currentGsrs > lastGsrs
  const message = `Your GSRS has ${
    increased ? "increased" : "decreased"
  } by ${currentGsrsPercentDifference}%`

  return {
    // score should be the difference between the two
    latest: String(currentGsrs),
    score: lastGsrs - currentGsrs,
    currentScore: currentGsrs,
    date: currentTask.completedAt,
    increased,
    // make sure currentGsrsPercentDifference is a number and not NaN
    percentDifference: currentGsrsPercentDifference
      ? currentGsrsPercentDifference
      : 0,
    message,
    task,
  }
}

function calculateSingleGsrs(currentTask: UserTask, task: TaskType): Score {
  // lastTask.answers is an array of objects and each object has a key and value
  const currentGsrs = answersReductionCalculation(
    currentTask.answers,
    gsrsQuestions
  )
  const message = `Your GSRS is ${currentGsrs}`

  return {
    // score should be the difference between the two
    latest: String(currentGsrs),
    score: currentGsrs,
    currentScore: currentGsrs,
    date: currentTask.completedAt,
    message,
    task,
  }
}

function calculateTefq(
  lastTask: UserTask,
  currentTask: UserTask,
  task: TaskType
): Score {
  const lastTefq = answersReductionCalculation(lastTask.answers, tefqQuestions)
  const currentTefq = answersReductionCalculation(
    currentTask.answers,
    tefqQuestions
  )

  const percentileKey = getHadsPercentile(currentTefq)
  const currentTefqPercentDifference = getPercentageChange(
    lastTefq,
    currentTefq
  )
  const increased = currentTefq > lastTefq
  const message = `Your TEFQ has ${
    increased ? "increased" : "decreased"
  } by ${currentTefqPercentDifference}% and your percentile is ${percentileKey}`
  // make sure currentTefqPercentDifference is a number and not NaN and is not Infinity
  const confirmPercentDifferenceValue =
    isNaN(currentTefqPercentDifference) ||
    isFinite(currentTefqPercentDifference)
      ? 0
      : currentTefqPercentDifference
  const calculatedZScore = getZScore(currentTefq, 5.14, 2.65)
  const calculatedPercentile = getZPercent(calculatedZScore) * 100
  return {
    calculatedPercentile,
    latest: String(currentTefq),
    score: confirmPercentDifferenceValue,
    date: currentTask.completedAt,
    increased,
    percentDifference: confirmPercentDifferenceValue,
    message,
    task,
    percentile: String(percentileKey),
  }
}

function calculateSingleTefq(currentTask: UserTask, task: TaskType): Score {
  const currentTefq = answersReductionCalculation(
    currentTask.answers,
    tefqQuestions
  )

  const percentileKey = getHadsPercentile(currentTefq)

  const message = `Your TEFQ is ${currentTefq} and your percentile is ${percentileKey}`
  const confirmPercentDifferenceValue =
    isNaN(currentTefq) || isFinite(currentTefq) ? 0 : currentTefq
  const calculatedZScore = getZScore(currentTefq, 5.14, 2.65)
  const calculatedPercentile = getZPercent(calculatedZScore) * 100
  return {
    calculatedPercentile,
    percentile: String(percentileKey),
    latest: String(currentTefq),
    score: confirmPercentDifferenceValue,
    date: currentTask.completedAt,
    message,
    task,
  }
}
function calculateAdLibitumScore(
  lastTask: UserTask,
  currentTask: UserTask,
  task: TaskType
): Score {
  // [{"key": "calories", "value": "60", "type": "NUMBER"}]
  const lastCalories = Number(lastTask.answers[0]?.value)
  const currentCalories = Number(currentTask.answers[0]?.value)

  const currentCaloriesPercentDifference = getPercentageChange(
    lastCalories,
    currentCalories
  )
  const increased = currentCalories > lastCalories
  const message = `Your calories have ${
    increased ? "increased" : "decreased"
  } by ${currentCaloriesPercentDifference}%`
  const percentileKey =
    currentCalories > 1283
      ? 95
      : currentCalories > 1177
      ? 90
      : currentCalories > 1000
      ? 75
      : currentCalories > 803
      ? 50
      : currentCalories > 606
      ? 25
      : 0
  const calculatedZScore = getZScore(currentCalories, 803, 291.851852)
  const calculatedPercentile = getZPercent(calculatedZScore) * 100
  return {
    calculatedPercentile,
    percentile: String(percentileKey),
    latest: String(currentCalories),
    score: currentCaloriesPercentDifference,
    date: currentTask.completedAt,
    increased,
    percentDifference: currentCaloriesPercentDifference,
    message,
    task,
  }
}
function calculateSingleAdLibitum(
  currentTask: UserTask,
  task: TaskType
): Score {
  const currentCalories = Number(currentTask.answers[0]?.value)
  const message = `Current calories consumed is: ${currentCalories}`
  const percentileKey =
    currentCalories > 1283
      ? 95
      : currentCalories > 1177
      ? 90
      : currentCalories > 1000
      ? 75
      : currentCalories > 803
      ? 50
      : currentCalories > 606
      ? 25
      : 0
  const calculatedZScore = getZScore(currentCalories, 803, 291.851852)
  const calculatedPercentile = getZPercent(calculatedZScore) * 100
  return {
    calculatedPercentile,
    percentile: String(percentileKey),
    latest: String(currentCalories),
    score: currentCalories,
    date: currentTask.completedAt,
    message,
    task,
  }
}
export function calculateScore(
  lastTask: UserTask,
  currentTask: UserTask,
  taskType: TaskType
): Score {
  if (taskType === TaskType.MP_FEELING) {
    if (lastTask) {
      return calculateMPFeelingScore(lastTask, currentTask, taskType)
    } else {
      return calculateSingleMPFeeling(currentTask, taskType)
    }
  }
  if (
    taskType === TaskType.MP_ACTIVITY ||
    taskType === TaskType.WEIGHT_LOG ||
    taskType === TaskType.WAIST_LOG
  ) {
    if (lastTask) {
      return calculateActivityScore(lastTask, currentTask, taskType)
    } else {
      return calculateSingleMPActivity(currentTask, taskType)
    }
  }
  if (taskType === TaskType.MP_HUNGER) {
    if (lastTask) {
      return calculateHungerScore(lastTask, currentTask, taskType)
    } else {
      return calculateSingleMPHunger(currentTask, taskType)
    }
  }

  if (taskType === TaskType.BP_LOG) {
    if (lastTask) {
      return calculateBPLogScore(lastTask, currentTask, taskType)
    } else {
      return calculateSingleBPLog(currentTask, taskType)
    }
  }
  if (taskType === TaskType.GSRS) {
    if (lastTask) {
      return calculateGsrs(lastTask, currentTask, taskType)
    } else {
      return calculateSingleGsrs(currentTask, taskType)
    }
  }
  if (taskType === TaskType.TEFQ) {
    if (lastTask) {
      return calculateTefq(lastTask, currentTask, taskType)
    } else {
      return calculateSingleTefq(currentTask, taskType)
    }
  }
  if (taskType === TaskType.AD_LIBITUM) {
    if (lastTask) {
      return calculateAdLibitumScore(lastTask, currentTask, taskType)
    } else {
      return calculateSingleAdLibitum(currentTask, taskType)
    }
  }
  return null
}

function answersReductionCalculation(
  answers: UserAnswer[],
  answersMap: Record<string, Record<string, number>>
) {
  return (answers ?? []).reduce((sum, answer: UserAnswerTypes) => {
    if (answer.type === AnswerType.STRING) {
      return sum + answersMap[answer.key][answer.value]
    } else if (answer.type === AnswerType.NUMBER) {
      return sum + Number(answer.value)
    } else {
      throw new Error("Unexpected answer type in score calculation.")
    }
  }, 0)
}

function getHadsPercentile(currentTaskScore: number) {
  const percentileKey = Object.keys(hadsPercentile).reduce((acc, key) => {
    const value = parseInt(key)
    if (value < currentTaskScore) return hadsPercentile[value]
    else return acc
  }, 0)

  return percentileKey
}

function getStepsPercentile(currentTaskScore: number) {
  return Object.keys(stepsPercentile).reduce((acc, key) => {
    const value = parseInt(key)
    if (value <= currentTaskScore) return stepsPercentile[value]
    else return acc
  }, 0)
}

function getHungerDifferencePercentile(currentHungerLevel: number | string) {
  const currentValue =
    typeof currentHungerLevel === "string"
      ? parseInt(currentHungerLevel)
      : currentHungerLevel

  const percentile = Object.keys(hungerPercentile).reduce((acc, key) => {
    const value = parseInt(key)
    if (value <= currentValue) return hungerPercentile[value]
    else return acc
  }, 0)

  return percentile
}

function getHungerPercentile(hungerLevel: string | number) {
  const currentValue =
    typeof hungerLevel === "string" ? parseInt(hungerLevel) : hungerLevel

  const percentile =
    currentValue <= 45
      ? "25"
      : currentValue <= 64
      ? "50"
      : currentValue <= 83
      ? "75"
      : currentValue <= 100
      ? "90"
      : "95"

  return percentile
}

function getAnswerByKey<T>(
  answers: UserAnswer[],
  key: string,
  asType: (value: any) => T,
  defaultValue: T = null
) {
  const answer = answers.find((ans) => ans.key === key)
  if (answer) return asType(answer.value)
  else return defaultValue
}

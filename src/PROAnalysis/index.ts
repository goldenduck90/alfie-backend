import { TaskType } from "../schema/task.schema"
import { Score } from "../schema/user.schema"
import {
  UserNumberAnswer,
  UserStringAnswer,
  UserTask,
} from "../schema/task.user.schema"
import { gsrsQuestions, mpFeelingQuestions, tefqQuestions } from "./questions"

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
function GetZPercent(z: number) {
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

// zScore is just (score - mean)/standard deviation
function getZScore(score: number, mean: number, sd: number) {
  return (score - mean) / sd
}
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
  const calculatedZScore = getZScore(currentTaskScore, 3.9, 3.1)
  const calculatedPercentile = GetZPercent(calculatedZScore) * 100
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
function calculateSingleMPFeeling(currentTask: UserTask, task: TaskType) {
  const currentTaskScore = Object.keys(currentTask.answers).reduce(
    (acc, key: any) => {
      const answer: any = currentTask.answers[key]
      // eslint-disable-next-line no-prototype-builtins
      if (
        // eslint-disable-next-line no-prototype-builtins
        mpFeelingQuestions.hasOwnProperty(answer.key) &&
        // eslint-disable-next-line no-prototype-builtins
        mpFeelingQuestions[answer.key].hasOwnProperty(answer.value)
      ) {
        const score = mpFeelingQuestions[answer.key][answer.value]
        return acc + score
      } else {
        console.warn(
          `Invalid answer key or value for MP_FEELING: ${answer.key}, ${answer.value}`
        )
        return acc
      }
    },
    0
  )

  // Add a check for currentTaskScore being a valid number
  if (isNaN(currentTaskScore)) {
    console.warn("Invalid currentTaskScore for MP_FEELING:", currentTaskScore)
    return null
  }

  const percentileKey = Object.keys(hadspercentile).reduce((acc, key) => {
    const value = parseInt(key)
    if (value < currentTaskScore) {
      return hadspercentile[value]
    }
    return acc
  }, 0)

  const message = `You scored within the ${percentileKey} percentile`
  const calculatedZScore = getZScore(currentTaskScore, 3.9, 3.1)
  const calculatedPercentile = GetZPercent(calculatedZScore) * 100

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
  const lastTaskScore = Number(
    (lastTask?.answers[0] as UserNumberAnswer)?.value
  )
  const currentTaskScore = Number(
    (currentTask?.answers[0] as UserNumberAnswer)?.value
  )
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
  const currentTaskScore = Number(
    (currentTask.answers[0] as UserNumberAnswer).value
  )
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
  // const calculatedZScore = getZScore(currentTaskScore, 5.14, 2.65)
  // const calculatedPercentile = GetZPercent(calculatedZScore) * 100

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
  const currentHungerLevel1Hour = Number(
    (
      currentTask.answers.find(
        (answer) => answer.key === "hungerLevel1Hour"
      ) as UserNumberAnswer
    ).value
  )
  const currentHungerLevel30Mins = Number(
    (
      currentTask.answers.find(
        (answer) => answer.key === "hungerLevel30Mins"
      ) as UserNumberAnswer
    ).value
  )
  const percentile1hour =
    currentHungerLevel1Hour <= 45
      ? "25"
      : currentHungerLevel1Hour <= 64
      ? "50"
      : currentHungerLevel1Hour <= 83
      ? "75"
      : currentHungerLevel1Hour <= 100
      ? "90"
      : "95"
  const percentile30mins =
    currentHungerLevel30Mins <= 45
      ? "25"
      : currentHungerLevel30Mins <= 64
      ? "50"
      : currentHungerLevel30Mins <= 83
      ? "75"
      : currentHungerLevel30Mins <= 100
      ? "90"
      : "95"
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
  const percentile1hour =
    percentileDifferenceHungerPercentile1hour <= 45
      ? "25"
      : percentileDifferenceHungerPercentile1hour <= 64
      ? "50"
      : percentileDifferenceHungerPercentile1hour <= 83
      ? "75"
      : percentileDifferenceHungerPercentile1hour <= 100
      ? "90"
      : "95"
  const percentile30mins =
    percentileDifferenceHungerPercentile30mins <= 45
      ? "25"
      : percentileDifferenceHungerPercentile30mins <= 64
      ? "50"
      : percentileDifferenceHungerPercentile30mins <= 83
      ? "75"
      : percentileDifferenceHungerPercentile30mins <= 100
      ? "90"
      : "95"
  const calculatedZScore1hour = getZScore(currentHungerLevel1Hour, 64, 28.1)
  const calculatedZScore30mins = getZScore(currentHungerLevel30Mins, 64, 28.1)
  const calculated1hourPercent = GetZPercent(calculatedZScore1hour) * 100
  const calculated30minsPercent = GetZPercent(calculatedZScore30mins) * 100
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
  const currentSystolic = Number(
    currentTask.answers.find((answer) => answer.key === "systolicBp").value
  )
  const currentDiastolic = Number(
    currentTask.answers.find((answer) => answer.key === "diastolicBp").value
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
  const lastGsrs = Object.keys(lastTask.answers).reduce((acc, key: any) => {
    const answer: any = lastTask.answers[key]
    const score = gsrsQuestions[answer.key][answer.value]
    return acc + score
  }, 0)

  const currentGsrs = Object.keys(currentTask.answers).reduce(
    (acc, key: any) => {
      const answer: any = currentTask.answers[key]
      const score = gsrsQuestions[answer.key][answer.value]
      return acc + score
    },
    0
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
  const numericAnswers: UserStringAnswer[] = (currentTask.answers ||
    []) as any[]
  const currentGsrs = numericAnswers.reduce((acc, answer) => {
    const score = gsrsQuestions[answer.key][answer.value]
    return acc + (score || 0)
  }, 0)
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
  const lastTefq = Object.keys(lastTask.answers).reduce((acc, key: any) => {
    const answer: any = lastTask.answers[key]
    if (answer.key === "restraint") {
      return acc + Number(answer.value || 0)
    }
    const score = tefqQuestions[answer.key][answer.value]
    return acc + score
  }, 0)
  const currentTefq = Object.keys(currentTask.answers).reduce(
    (acc, key: any) => {
      const answer = currentTask.answers[key]
      if (answer.key === "restraint") {
        return acc + Number(answer.value || 0)
      }
      const score = tefqQuestions[answer.key][answer.value as string] || 0
      return acc + score
    },
    0
  )
  const percentileKey = Object.keys(hadspercentile).reduce((acc, key) => {
    const value = parseInt(key)
    if (value < currentTefq) {
      return hadspercentile[value]
    }
    return acc
  }, 0)
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
  const calculatedPercentile = GetZPercent(calculatedZScore) * 100
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
  const currentTefq = Object.keys(currentTask.answers).reduce(
    (acc, key: any) => {
      const answer: any = currentTask.answers[key]
      if (answer.key === "restraint") {
        return acc + Number(answer.value)
      }
      const score = tefqQuestions[answer.key][answer.value]
      return acc + score
    },
    0
  )
  const percentileKey = Object.keys(hadspercentile).reduce((acc, key) => {
    const value = parseInt(key)
    if (value < currentTefq) {
      return hadspercentile[value]
    }
    return acc
  }, 0)
  const message = `Your TEFQ is ${currentTefq} and your percentile is ${percentileKey}`
  const confirmPercentDifferenceValue =
    isNaN(currentTefq) || isFinite(currentTefq) ? 0 : currentTefq
  const calculatedZScore = getZScore(currentTefq, 5.14, 2.65)
  const calculatedPercentile = GetZPercent(calculatedZScore) * 100
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
  const lastCalories = Number((lastTask.answers[0] as UserNumberAnswer).value)
  const currentCalories = Number(
    (currentTask.answers[0] as UserNumberAnswer).value
  )
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
  const calculatedPercentile = GetZPercent(calculatedZScore) * 100
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
  const currentCalories = Number(
    (currentTask.answers[0] as UserNumberAnswer).value
  )
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
  const calculatedPercentile = GetZPercent(calculatedZScore) * 100
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

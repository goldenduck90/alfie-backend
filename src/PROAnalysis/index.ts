import { TaskType } from "../schema/task.schema"
import { Score } from "../schema/user.schema"
import {
  UserAnswer,
  UserAnswerTypes,
  UserTask,
} from "../schema/task.user.schema"
import AnswerType from "../schema/enums/AnswerType"
import { gsrsQuestions, mpFeelingQuestions, tefqQuestions } from "./questions"
import { distributions } from "./distributions"
import { ordinal } from "../utils/statistics"

export function calculateMPFeelingScore(
  lastTask: UserTask,
  currentTask: UserTask,
  task: TaskType
): Score {
  // We first need to create a score for the lastTask and the currentTask
  // We will create a score for task in it's entirety all the scores added together for each question will equal the score for the task

  const lastTaskScore = sumAnswersByMap(lastTask.answers, mpFeelingQuestions)
  const currentTaskScore = sumAnswersByMap(
    currentTask.answers,
    mpFeelingQuestions
  )

  const score = currentTaskScore - lastTaskScore
  const percentDifference = getPercentageChange(lastTaskScore, currentTaskScore)
  const increased = score > 0
  const percentile =
    distributions.MP_FEELING.display.percentile(currentTaskScore)
  const message = `You scored within the ${ordinal(percentile)} percentile`
  const calculatedPercentile =
    distributions.MP_FEELING.calculated.percentile(currentTaskScore)

  return {
    percentile,
    latest: String(currentTaskScore),
    score,
    calculatedPercentile,
    date: currentTask.completedAt,
    increased,
    percentDifference,
    message,
    task,
  }
}
function calculateSingleMPFeeling(
  currentTask: UserTask,
  task: TaskType
): Score {
  const currentTaskScore = sumAnswersByMap(
    currentTask.answers,
    mpFeelingQuestions
  )

  const percentile =
    distributions.MP_FEELING.display.percentile(currentTaskScore)

  const calculatedPercentile =
    distributions.MP_FEELING.calculated.percentile(currentTaskScore)

  const message = `You scored within the ${ordinal(percentile)} percentile`

  return {
    percentile,
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
  // The tasks in this category are all activity based tasks so their
  // values for each task are simple numbers
  // For Example: [{ "key": "weight", "value": "333", "type": "NUMBER" }]

  const lastTaskScore = Number(lastTask?.answers[0]?.value)
  const currentTaskScore = Number(currentTask?.answers[0]?.value)

  const score = currentTaskScore - lastTaskScore
  const percentDifference = getPercentageChange(lastTaskScore, currentTaskScore)
  const increased = currentTaskScore > lastTaskScore

  switch (task) {
    case TaskType.MP_ACTIVITY: {
      const percentile =
        distributions.MP_ACTIVITY.display.percentile(currentTaskScore)
      const calculatedPercentile =
        distributions.MP_ACTIVITY.calculated.percentile(currentTaskScore)

      const message = `You scored within the ${ordinal(percentile)} percentile`

      return {
        latest: String(currentTaskScore),
        score,
        date: currentTask.completedAt,
        increased,
        percentDifference,
        message,
        task,
        percentile,
        calculatedPercentile,
      }
    }
    case TaskType.WEIGHT_LOG: {
      const message = `Your weight has ${
        increased ? "increased" : "decreased"
      } by ${percentDifference}%`
      return {
        latest: String(currentTaskScore ?? ""),
        score,
        date: currentTask.completedAt,
        increased,
        percentDifference: percentDifference,
        message,
        task,
      }
    }
    case TaskType.WAIST_LOG: {
      const message = `Your waist has ${
        increased ? "increased" : "decreased"
      } by ${percentDifference}%`
      return {
        latest: String(currentTaskScore ?? ""),
        score,
        date: currentTask.completedAt,
        increased,
        percentDifference: percentDifference,
        message,
        task,
      }
    }
  }
}

function calculateSingleMPActivity(
  currentTask: UserTask,
  task: TaskType
): Score {
  const currentTaskScore = Number(currentTask.answers[0]?.value)
  const percentile =
    distributions.MP_ACTIVITY.display.percentile(currentTaskScore)
  const calculatedPercentile =
    distributions.MP_ACTIVITY.calculated.percentile(currentTaskScore)

  const message = `You scored within the ${ordinal(percentile)} percentile`

  return {
    calculatedPercentile,
    latest: String(currentTaskScore),
    date: currentTask.completedAt,
    message,
    task,
    percentile,
  }
}

function calculateSingleMPHunger(currentTask: UserTask, task: TaskType): Score {
  const hungerLevel1Hour = getAnswerByKey(
    currentTask.answers,
    "hungerLevel1Hour",
    Number
  )
  const hungerLevel30Minutes = getAnswerByKey(
    currentTask.answers,
    "hungerLevel30Mins",
    Number
  )

  const calculatedPercentile30Minutes =
    distributions.MP_HUNGER.calculated.percentile(hungerLevel30Minutes)
  const calculatedPercentile1Hour =
    distributions.MP_HUNGER.calculated.percentile(hungerLevel1Hour)

  const percentile30Minutes =
    distributions.MP_HUNGER.display.percentile(hungerLevel30Minutes)
  const percentile1Hour =
    distributions.MP_HUNGER.display.percentile(hungerLevel1Hour)

  return {
    calculatedPercentile: calculatedPercentile1Hour,
    calculatedPercentile30Minutes,
    calculatedPercentile1Hour,
    percentile: percentile1Hour,
    percentile30Minutes,
    percentile1Hour,
    latest: String(hungerLevel1Hour),
    date: currentTask.completedAt,
    task,
  }
}

function calculateHungerScore(
  lastTask: UserTask,
  currentTask: UserTask,
  task: TaskType
): Score {
  const currentHungerLevel1Hour = getAnswerByKey(
    currentTask.answers,
    "hungerLevel1Hour",
    Number
  )
  const currentHungerLevel30Minutes = getAnswerByKey(
    currentTask.answers,
    "hungerLevel30Mins",
    Number
  )
  const lastHungerLevel1Hour = getAnswerByKey(
    lastTask.answers,
    "hungerLevel1Hour",
    Number
  )
  const lastHungerLevel30Minutes = getAnswerByKey(
    lastTask.answers,
    "hungerLevel30Mins",
    Number
  )

  const change1Hour = getPercentageChange(
    lastHungerLevel1Hour,
    currentHungerLevel1Hour
  )
  const change30Minutes = getPercentageChange(
    lastHungerLevel30Minutes,
    currentHungerLevel30Minutes
  )

  const increased1Hour = currentHungerLevel1Hour > lastHungerLevel1Hour
  const increased30Minutes =
    currentHungerLevel30Minutes > lastHungerLevel30Minutes

  const percentile1Hour = distributions.MP_HUNGER.display.percentile(
    currentHungerLevel1Hour
  )
  const percentile30Minutes = distributions.MP_HUNGER.display.percentile(
    currentHungerLevel30Minutes
  )

  const calculatedPercentile1Hour =
    distributions.MP_HUNGER.calculated.percentile(currentHungerLevel1Hour)
  const calculatedPercentile30Minutes =
    distributions.MP_HUNGER.calculated.percentile(currentHungerLevel30Minutes)

  const message = `Your hunger level has ${
    increased1Hour ? "increased" : "decreased"
  } by ${change1Hour}% for 2 hours and ${
    increased30Minutes ? "increased" : "decreased"
  } by ${change30Minutes}% for 30 minutes and you scored within the ${ordinal(
    percentile1Hour
  )} percentile for 2 hours and ${ordinal(
    percentile30Minutes
  )} percentile for 30 minutes`

  return {
    calculatedPercentile: calculatedPercentile1Hour,
    percentile: percentile1Hour,
    calculatedPercentile1Hour,
    calculatedPercentile30Minutes,
    percentile1Hour,
    percentile30Minutes,
    latest: `2 hour: ${currentHungerLevel1Hour}, 30 mins: ${currentHungerLevel30Minutes}`,
    date: currentTask.completedAt,
    increased1Hour,
    increased30Minutes,
    percentDifference1Hour: change1Hour,
    percentDifference30Minutes: change30Minutes,
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
  if (currentSystolic > 140 || currentDiastolic > 90) {
    providerMessage =
      "Your systolic is > 140 or diastolic is > 90, go to next highest category. If above 130/80, ask if they are taking htn drugs."
  } else if (currentSystolic > 130 && currentDiastolic > 80) {
    providerMessage =
      "For geriatrics, if systolic is >130 and diastolic > 80, cannot be prescribed bupropion or phentermine"
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
  if (currentSystolic > 140 || currentDiastolic > 90) {
    providerMessage =
      "Your systolic is > 140 or diastolic is > 90, go to next highest category. If above 130/80, ask if they are taking htn drugs."
  } else if (currentSystolic > 130 && currentDiastolic > 80) {
    providerMessage =
      "For geriatrics, if systolic is >130 and diastolic > 80, cannot be prescribed bupropion or phentermine"
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
  const lastGsrs = sumAnswersByMap(lastTask.answers, gsrsQuestions)
  const currentGsrs = sumAnswersByMap(currentTask.answers, gsrsQuestions)

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
  const currentGsrs = sumAnswersByMap(currentTask.answers, gsrsQuestions)
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
  const lastTefq = sumAnswersByMap(lastTask.answers, tefqQuestions)
  const currentTefq = sumAnswersByMap(currentTask.answers, tefqQuestions)

  const percentile = distributions.TEFQ.display.percentile(currentTefq)

  const percentDifference = getPercentageChange(lastTefq, currentTefq)
  const increased = currentTefq > lastTefq

  const message = `Your TEFQ has ${
    increased ? "increased" : "decreased"
  } by ${percentDifference}% and your percentile is ${ordinal(percentile)}`

  const calculatedPercentile =
    distributions.TEFQ.calculated.percentile(currentTefq)

  return {
    calculatedPercentile,
    latest: String(currentTefq),
    score: percentDifference,
    date: currentTask.completedAt,
    increased,
    percentDifference,
    message,
    task,
    percentile,
  }
}

function calculateSingleTefq(currentTask: UserTask, task: TaskType): Score {
  const currentTefq = sumAnswersByMap(currentTask.answers, tefqQuestions)

  const percentile = distributions.TEFQ.display.percentile(currentTefq)

  const message = `Your TEFQ is ${currentTefq} and your percentile is ${ordinal(
    percentile
  )}`

  const calculatedPercentile =
    distributions.TEFQ.calculated.percentile(currentTefq)

  return {
    calculatedPercentile,
    percentile,
    latest: String(currentTefq),
    score: currentTefq,
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
  const lastCalories = Number(lastTask.answers[0]?.value ?? 0)
  const currentCalories = Number(currentTask.answers[0]?.value ?? 0)

  const percentDifference = getPercentageChange(lastCalories, currentCalories)
  const increased = currentCalories > lastCalories
  const message = `Your calories have ${
    increased ? "increased" : "decreased"
  } by ${percentDifference}%`
  const percentile =
    distributions.AD_LIBITUM.display.percentile(currentCalories)
  const calculatedPercentile =
    distributions.AD_LIBITUM.calculated.percentile(currentCalories)

  return {
    calculatedPercentile,
    percentile,
    latest: String(currentCalories),
    score: percentDifference,
    date: currentTask.completedAt,
    increased,
    percentDifference,
    message,
    task,
  }
}

function calculateSingleAdLibitum(
  currentTask: UserTask,
  task: TaskType
): Score {
  const currentCalories = Number(currentTask.answers[0]?.value ?? 0)
  const message = `Current calories consumed is: ${currentCalories}`
  const percentile =
    distributions.AD_LIBITUM.display.percentile(currentCalories)
  const calculatedPercentile =
    distributions.AD_LIBITUM.calculated.percentile(currentCalories)

  return {
    calculatedPercentile,
    percentile,
    latest: String(currentCalories),
    score: currentCalories,
    date: currentTask.completedAt,
    message,
    task,
  }
}

/**
 * Calculates a score from a user task delta (previous and latest user task)
 * for a given task type.
 */
export function calculateScore(
  lastTask: UserTask,
  currentTask: UserTask,
  taskType: TaskType
): Score {
  switch (taskType) {
    case TaskType.MP_FEELING:
      if (lastTask) {
        return calculateMPFeelingScore(lastTask, currentTask, taskType)
      } else {
        return calculateSingleMPFeeling(currentTask, taskType)
      }
    case TaskType.MP_ACTIVITY:
    case TaskType.WEIGHT_LOG:
    case TaskType.WAIST_LOG:
      if (lastTask) {
        return calculateActivityScore(lastTask, currentTask, taskType)
      } else {
        return calculateSingleMPActivity(currentTask, taskType)
      }
    case TaskType.MP_HUNGER:
      if (lastTask) {
        return calculateHungerScore(lastTask, currentTask, taskType)
      } else {
        return calculateSingleMPHunger(currentTask, taskType)
      }
    case TaskType.BP_LOG:
      if (lastTask) {
        return calculateBPLogScore(lastTask, currentTask, taskType)
      } else {
        return calculateSingleBPLog(currentTask, taskType)
      }
    case TaskType.GSRS:
      if (lastTask) {
        return calculateGsrs(lastTask, currentTask, taskType)
      } else {
        return calculateSingleGsrs(currentTask, taskType)
      }
    case TaskType.TEFQ:
      if (lastTask) {
        return calculateTefq(lastTask, currentTask, taskType)
      } else {
        return calculateSingleTefq(currentTask, taskType)
      }
    case TaskType.AD_LIBITUM:
      if (lastTask) {
        return calculateAdLibitumScore(lastTask, currentTask, taskType)
      } else {
        return calculateSingleAdLibitum(currentTask, taskType)
      }
  }

  return null
}

/**
 * Sums the user answers, using an `answersMap` to retrieve numeric
 * values from preset string answers, or adding number answers directly
 * to the sum.
 */
export function sumAnswersByMap(
  answers: UserAnswer[],
  answersMap: Record<string, Record<string, number>>
) {
  return (answers ?? []).reduce((sum, answer: UserAnswerTypes) => {
    if (answer.type === AnswerType.STRING) {
      return sum + (answersMap[answer.key][answer.value] ?? 0)
    } else if (answer.type === AnswerType.NUMBER) {
      return sum + Number(answer.value)
    } else {
      throw new Error(
        `Unexpected answer type ${answer.type} in score calculation.`
      )
    }
  }, 0)
}

/**
 * Retrieve an answer from a UserAnswer array by `key`, with a type
 * cast function and optional default value if not present.
 */
export function getAnswerByKey<T>(
  answers: UserAnswer[],
  key: string,
  asType: (value: any) => T,
  defaultValue: T = null
) {
  const answer = answers.find((ans) => ans.key === key)
  if (answer) return asType(answer.value)
  else return defaultValue
}

/** Returns the percent change from `oldNumber` to `newNumber` */
function getPercentageChange(oldNumber: number, newNumber: number): number {
  if (oldNumber === 0) {
    return 0
  } else {
    const delta = oldNumber - newNumber
    return Math.abs(Math.round((delta / oldNumber) * 100))
  }
}

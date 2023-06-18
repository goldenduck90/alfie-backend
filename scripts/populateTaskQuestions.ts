import prepareShellEnvironment from "./utils/prepareShellEnvironment"
import { TaskQuestion, TaskModel } from "../src/schema/task.schema"
import { AnswerType } from "../src/schema/enums/AnswerType"

async function populateTaskQuestions() {
  await prepareShellEnvironment()

  console.log("Updating Task.questions fields.")
  const questionsData = taskQuestionsData()

  await Promise.all(
    Object.entries(questionsData).map(async ([taskType, questions]) => {
      const updatedTask = await TaskModel.findOneAndUpdate(
        { type: taskType },
        { questions: questions },
        { new: true }
      )
      if (updatedTask) {
        console.log(
          `* Updated task ${taskType}: ${JSON.stringify(
            updatedTask.toObject()
          )}`
        )
      } else {
        console.log(
          `# Could not update task ${taskType} (does not exist in database)`
        )
      }
    })
  )
}

populateTaskQuestions()
  .catch((error) => {
    console.log(error)
    process.exit(1)
  })
  .then(() => process.exit(0))

function taskQuestionsData(): Record<string, TaskQuestion[]> {
  return {
    NEW_PATIENT_INTAKE_FORM: [
      { key: "allergies", type: AnswerType.STRING },
      { key: "conditions", type: AnswerType.ARRAY },
      { key: "pharmacyLocation", type: AnswerType.STRING },
      { key: "usePillPack", type: AnswerType.BOOLEAN },
      { key: "previousConditions", type: AnswerType.ARRAY },
      { key: "hasSurgeries", type: AnswerType.BOOLEAN },
      { key: "surgicalHistory", type: AnswerType.STRING },
      { key: "hasRequiredLabs", type: AnswerType.BOOLEAN },
      { key: "weightLossAttemptTime", type: AnswerType.STRING },
      { key: "weightManagementMethods", type: AnswerType.ARRAY },
    ],

    MP_HUNGER: [
      { key: "foodEaten", type: AnswerType.STRING },
      { key: "hungerLevel30Mins", type: AnswerType.NUMBER },
      { key: "hungerLevel1Hour", type: AnswerType.NUMBER },
    ],

    MP_FEELING: [
      { key: "tenseLevel", type: AnswerType.STRING },
      { key: "frightenedLevel", type: AnswerType.STRING },
      { key: "worryAmount", type: AnswerType.STRING },
      { key: "easeFrequency", type: AnswerType.STRING },
      { key: "frightenedFrequency", type: AnswerType.STRING },
      { key: "restlessAmount", type: AnswerType.STRING },
      { key: "panicFrequency", type: AnswerType.STRING },
    ],

    BP_LOG: [
      { key: "systolicBp", type: AnswerType.NUMBER },
      { key: "diastolicBp", type: AnswerType.NUMBER },
    ],

    WEIGHT_LOG: [
      { key: "weight", type: AnswerType.NUMBER },
      { key: "withingsWeight", type: AnswerType.NUMBER },
    ],

    WAIST_LOG: [{ key: "waist", type: AnswerType.NUMBER }],

    MP_ACTIVITY: [{ key: "stepsPerDay", type: AnswerType.NUMBER }],

    MP_BLUE_CAPSULE: [
      { key: "bluePillTimeTaken", type: AnswerType.DATE },
      { key: "foodTaken", type: AnswerType.STRING },
    ],

    MP_BLUE_CAPSULE_2: [
      { key: "bluePillPartTwoTimeTaken", type: AnswerType.DATE },
    ],
    FOOD_LOG: [
      { key: "breakfast", type: AnswerType.STRING },
      { key: "lunch", type: AnswerType.STRING },
      { key: "dinner", type: AnswerType.STRING },
    ],
    TEFQ: [
      { key: "alwaysEating", type: AnswerType.STRING },
      { key: "smallHelpings", type: AnswerType.STRING },
      { key: "anxiousEating", type: AnswerType.STRING },
      { key: "uncontrollableEating", type: AnswerType.STRING },
      { key: "eatingWithOthers", type: AnswerType.STRING },
      { key: "overeatingWhenBlue", type: AnswerType.STRING },
      { key: "delicacyEating", type: AnswerType.STRING },
      { key: "bottomlessPit", type: AnswerType.STRING },
      { key: "alwaysHungry", type: AnswerType.STRING },
      { key: "lonelyEating", type: AnswerType.STRING },
      { key: "holdBack", type: AnswerType.STRING },
      { key: "fatFoods", type: AnswerType.STRING },
      { key: "alwaysHungry2", type: AnswerType.STRING },
      { key: "howOftenHungry", type: AnswerType.STRING },
      { key: "avoidStockingUp", type: AnswerType.STRING },
      { key: "conciouslyEatLess", type: AnswerType.STRING },
      { key: "eatingBinges", type: AnswerType.STRING },
      { key: "restraint", type: AnswerType.NUMBER },
    ],
    GSRS: [
      { key: "painOrDiscomfort", type: AnswerType.STRING },
      { key: "heartBurn", type: AnswerType.STRING },
      { key: "acidReflux", type: AnswerType.STRING },
      { key: "hungerPains", type: AnswerType.STRING },
      { key: "nausea", type: AnswerType.STRING },
      { key: "rumbling", type: AnswerType.STRING },
      { key: "bloated", type: AnswerType.STRING },
      { key: "burping", type: AnswerType.STRING },
      { key: "gas", type: AnswerType.STRING },
      { key: "constipation", type: AnswerType.STRING },
      { key: "diarrhea", type: AnswerType.STRING },
      { key: "looseStools", type: AnswerType.STRING },
      { key: "hardStools", type: AnswerType.STRING },
      { key: "urgentBowel", type: AnswerType.STRING },
      { key: "completeBowels", type: AnswerType.STRING },
    ],
    LAB_SELECTION: [
      { key: "labCorpLocation", type: AnswerType.STRING },
      { key: "hasRequiredLabs", type: AnswerType.BOOLEAN },
    ],
    AD_LIBITUM: [{ key: "calories", type: AnswerType.NUMBER }],
  }
}

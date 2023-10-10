import runShell, { createProgram } from "./utils/runShell"

import { initializeCollection } from "../src/database/initializeCollection"
import tasksData from "../src/database/data/tasks.json"
import insuranceData from "../src/database/data/insurances.json"
import { TaskModel, Task } from "../src/schema/task.schema"
import { Insurance, InsuranceModel } from "../src/schema/insurance.schema"

const collectionsMap = {
  tasks: {
    rawData: tasksData,
    model: TaskModel,
    type: Task,
    getKey: (task: Task) => task.type,
  },
  insurance: {
    rawData: insuranceData,
    model: InsuranceModel,
    type: Insurance,
    getKey: (insurance: Insurance) => insurance._id,
  },
}

type TableNames = (keyof typeof collectionsMap)[]

const program = createProgram()
  .description("Populates entries for static collections in MongoDB.")
  .option("--tasks", "Populates the tasks collection.", false)
  .option("--insurance", "Populates the insurances collection.", false)
  .parse()

const options: Record<string, boolean> = program.opts()

async function populateCollection() {
  const collections: TableNames = Object.entries(options)
    .filter(([, value]) => value)
    .map(([key]) => key) as unknown as TableNames

  for (const collection of collections) {
    const params = collectionsMap[collection]
    const results = await initializeCollection<any>(
      params.model,
      params.rawData,
      params.getKey
    )

    console.log("Created entries: ", JSON.stringify(results, null, "  "))
  }
}

runShell(() => populateCollection())

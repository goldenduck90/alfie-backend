import runShell, { createProgram } from "./utils/runShell"

import { initializeCollection } from "../src/database/initializeCollection"
import tasksData from "../src/database/data/tasks.json"
import insuranceTypesData from "../src/database/data/insuranceTypes.json"
import insurancePlansData from "../src/database/data/insurancePlans.json"
import insurancePlanCoverageData from "../src/database/data/insurancePlanCoverage.json"
import { TaskModel, Task } from "../src/schema/task.schema"
import {
  InsuranceType,
  InsurancePlan,
  InsuranceTypeModel,
  InsurancePlanModel,
  InsurancePlanCoverageModel,
  InsurancePlanCoverage,
} from "../src/schema/insurance.schema"

const collectionsMap = {
  tasks: {
    rawData: tasksData,
    model: TaskModel,
    type: Task,
    getKey: (task: Task) => task.type,
  },
  insuranceTypes: {
    rawData: insuranceTypesData,
    model: InsuranceTypeModel,
    type: InsuranceType,
    getKey: (type: InsuranceType) => type.type,
  },
  insurancePlans: {
    rawData: insurancePlansData,
    model: InsurancePlanModel,
    type: InsurancePlan,
    getKey: (plan: InsurancePlan) => plan.value,
  },
  insurancePlanCoverage: {
    rawData: insurancePlanCoverageData,
    model: InsurancePlanCoverageModel,
    type: InsurancePlanCoverage,
    getKey: (coverage: InsurancePlanCoverage) =>
      `${coverage.plan}-${coverage.type}-${coverage.state}-${coverage.provider}`,
  },
}

type TableNames = (keyof typeof collectionsMap)[]

const program = createProgram()
  .description("Populates entries for static collections in MongoDB.")
  .option("--tasks", "Populates the tasks collection.", false)
  .option(
    "--insurance-plans",
    "Populates the insurancePlans collection.",
    false
  )
  .option(
    "--insurance-types",
    "Populates the insuranceTypes collection.",
    false
  )
  .option(
    "--insurance-plan-coverage",
    "Populates the insurancePlanCoverage collection.",
    false
  )
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

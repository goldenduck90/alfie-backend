import { TaskType } from "../schema/task.schema"
import { NormalDistribution } from "../utils/NormalDistribution"
import config from "./distributionsConfig.json"

// Import distributions.json into NormalDistributions
// mapped by task type and calculated/display intent.
const taskTypes: TaskType[] = Object.keys(config) as any

const dist: Record<string, Record<string, NormalDistribution>> = {}

taskTypes.forEach((taskType) => {
  dist[taskType] = {} as any
  ;["calculated", "display"].forEach((category) => {
    const params = (config as any)[taskType][category]
    dist[taskType][category] = new NormalDistribution(
      params.mean,
      params.standardDeviation
    )
  })
})

export const distributions: Record<
  TaskType,
  Record<"calculated" | "display", NormalDistribution>
> = dist as any

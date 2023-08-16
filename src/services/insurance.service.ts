import {
  InsuranceCoveredResponse,
  InsurancePlanCoverageModel,
  InsurancePlanValue,
  InsurancePlanModel,
  InsuranceTypeModel,
  InsuranceTypeValue,
} from "../schema/insurance.schema"
import { Provider } from "../schema/provider.schema"

export default class InsuranceService {
  /** Whether the given plan and insurance type are covered. */
  async isCovered(params: {
    plan: InsurancePlanValue
    type: InsuranceTypeValue
    state: string
  }): Promise<InsuranceCoveredResponse> {
    const plan = await this.getPlanCoverage(params)
    return {
      covered: plan !== null,
      reason: !plan ? "Not covered" : null,
    }
  }

  async getPlanCoverage(params: {
    plan: InsurancePlanValue
    type: InsuranceTypeValue
    state: string
  }) {
    const plans = await InsurancePlanCoverageModel.find({}).populate<{
      provider: Provider
    }>("provider")

    const plan = plans.find(({ plan: planValue, type, state, covered }) => {
      return (
        covered &&
        params.plan === planValue &&
        (type === null || params.type === type) &&
        (state === null || state === params.state)
      )
    })

    return plan ?? null
  }

  async getPlans() {
    return await InsurancePlanModel.find({})
  }

  async getPlanTypes() {
    return await InsuranceTypeModel.find({})
  }
}

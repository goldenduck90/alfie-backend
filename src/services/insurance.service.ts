import {
  InsuranceCoveredResponse,
  InsurancePlanCoverageModel,
  InsurancePlanValue,
  InsuranceTypeValue,
} from "../schema/insurance.schema"

export default class InsuranceService {

  /** Whether the given plan and insurance type are covered. */
  async isCovered(
    planValue: InsurancePlanValue | null,
    planType: InsuranceTypeValue | null
  ): Promise<InsuranceCoveredResponse> {
    const plan = await InsurancePlanCoverageModel.findOne({
      value: planValue ?? null,
      types: planType ?? null,
      covered: true,
    })

    return {
      covered: plan !== null,
      reason: !plan ? "Not covered" : null,
    }
  }
}

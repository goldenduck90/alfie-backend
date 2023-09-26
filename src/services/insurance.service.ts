import {
  InsuranceCoveredResponse,
  InsurancePlanCoverageModel,
  InsurancePlanValue,
  InsurancePlanModel,
  InsuranceTypeModel,
  InsuranceTypeValue,
  BasicUserInsuranceInfo,
} from "../schema/insurance.schema"
import { CheckoutModel } from "../schema/checkout.schema"
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
      covered: plan !== null && plan.covered,
      comingSoon: plan !== null && plan.comingSoon,
      reason: !plan ? "Not covered or coming soon" : null,
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

    const coveredPlan = plans.find(
      ({ plan: planValue, type, state, covered }) => {
        return (
          covered &&
          params.plan === planValue &&
          (type === null || params.type === type) &&
          (state === null || state === params.state)
        )
      }
    )

    const comingSoonPlan = plans.find(
      ({ plan: planValue, type, state, comingSoon }) => {
        return (
          comingSoon &&
          params.plan === planValue &&
          (type === null || params.type === type) &&
          (state === null || state === params.state)
        )
      }
    )

    return coveredPlan ?? comingSoonPlan ?? null
  }

  async getCheckoutUserBasicInfo(
    checkoutId: string
  ): Promise<BasicUserInsuranceInfo> {
    const checkout = await CheckoutModel.findById(checkoutId)
    return {
      state: checkout.state,
      dateOfBirth: checkout.dateOfBirth,
      gender: checkout.gender,
      name: checkout.name,
    }
  }

  async getPlans() {
    return await InsurancePlanModel.find({})
  }

  async getPlanTypes() {
    return await InsuranceTypeModel.find({})
  }
}

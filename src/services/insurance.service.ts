import {
  InsuranceCoveredResponse,
  InsurancePlanCoverageModel,
  InsurancePlanValue,
  InsurancePlanModel,
  InsuranceTypeModel,
  InsuranceTypeValue,
  InsuranceCPIDModel,
  BasicUserInsuranceInfo,
} from "../schema/insurance.schema"
// import lookupCPID from "../utils/lookupCPID"
// import resolveCPIDEntriesToInsurance from "../utils/resolveCPIDEntriesToInsurance"
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
      covered: !!plan?.covered,
      comingSoon: !!plan?.comingSoon,
      reason: !plan ? "Not covered or coming soon" : null,
    }
  }

  async getCPIDs(params: {
    plan: InsurancePlanValue
    planType: InsuranceTypeValue
    state: string
    npi?: string
  }) {
    const cpids = await InsuranceCPIDModel.find({
      states: params.state,
      planTypes: params.planType,
      plan: params.plan,
    })

    return cpids
  }

  async getPlanCoverage(params: {
    plan: InsurancePlanValue
    type: InsuranceTypeValue
    state: string
  }) {
    const plan = await InsurancePlanCoverageModel.findOne({
      plan: params.plan,
      state: {
        $in: [null, params.state],
      },
      type: {
        $in: [null, params.type],
      },
      $or: [
        {
          comingSoon: true,
        },
        {
          covered: true,
        },
      ],
    }).populate<{
      provider: Provider
    }>("provider")

    return plan
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

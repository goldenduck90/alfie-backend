import { Arg, Mutation, Query, Resolver } from "type-graphql"
import { ApolloError } from "apollo-server"
import {
  InsurancePlanValue,
  InsuranceTypeValue,
  InsuranceCoveredResponse,
  InsurancePlansResponse,
  InsuranceCheckInput,
  InsuranceCheckResponse,
} from "../schema/insurance.schema"
import CandidService from "../services/candid.service"
import InsuranceService from "../services/insurance.service"
import { Insurance, InsuranceEligibilityResponse } from "../schema/user.schema"
// import resolveCPIDEntriesToInsurance from "../utils/resolveCPIDEntriesToInsurance"
import { CheckoutModel } from "../schema/checkout.schema"

@Resolver()
export default class InsuranceResolver {
  private candidService: CandidService
  private insuranceService: InsuranceService

  constructor() {
    this.candidService = new CandidService()
    this.insuranceService = new InsuranceService()
  }

  @Mutation(() => InsuranceCheckResponse)
  async insuranceCheck(
    @Arg("input") input: InsuranceCheckInput
  ): Promise<InsuranceCheckResponse> {
    try {
      const checkout = await CheckoutModel.findById(input.checkoutId)

      const eligible = await this.insuranceEligibility(
        input.checkoutId,
        input.insurancePlan,
        input.insuranceType,
        input.insurance
      )

      checkout.insurancePlan = input.insurancePlan
      checkout.insuranceType = input.insuranceType
      checkout.insurance = input.insurance
      checkout.insuranceCovered = input.covered && eligible.eligible
      await checkout.save()

      return {
        eligible,
      }
    } catch (error) {
      throw new ApolloError(error.message, "ERROR")
    }
  }

  @Query(() => InsuranceCoveredResponse)
  async insuranceCovered(
    @Arg("insurancePlan", () => InsurancePlanValue)
    insurancePlan: InsurancePlanValue,

    @Arg("insuranceType", () => InsuranceTypeValue)
    insuranceType: InsuranceTypeValue,

    @Arg("checkoutId")
    checkoutId: string
  ): Promise<InsuranceCoveredResponse> {
    const user = await this.insuranceService.getCheckoutUserBasicInfo(
      checkoutId
    )
    const covered = await this.insuranceService.isCovered({
      plan: insurancePlan,
      type: insuranceType,
      state: user.state,
    })

    return covered
  }

  @Query(() => InsuranceEligibilityResponse)
  async insuranceEligibility(
    @Arg("checkoutId", () => String)
    checkoutId: string,
    @Arg("insurancePlan", () => InsurancePlanValue)
    insurancePlan: InsurancePlanValue,
    @Arg("insuranceType", () => InsuranceTypeValue)
    insuranceType: InsuranceTypeValue,
    @Arg("insurance", () => Insurance)
    insurance: Insurance,
    @Arg("cpid", { nullable: true }) cpid?: string
  ): Promise<InsuranceEligibilityResponse> {
    const user = await this.insuranceService.getCheckoutUserBasicInfo(
      checkoutId
    )

    let inputs: { insurance: Insurance; cpid: string }[] = []
    if (cpid) {
      inputs = [{ insurance, cpid }]
    } else {
      const cpids = await this.insuranceService.getCPIDs({
        plan: insurancePlan,
        planType: insuranceType,
        state: user.state,
      })
      inputs = cpids.map((cpidEntry) => ({
        insurance,
        cpid: cpidEntry.cpid,
      }))
    }
    const eligible = await this.candidService.checkInsuranceEligibility(
      user,
      inputs
    )

    return eligible
  }

  @Query(() => InsurancePlansResponse)
  async insurancePlans() {
    const plans = await this.insuranceService.getPlans()
    const types = await this.insuranceService.getPlanTypes()

    return { plans, types }
  }
}

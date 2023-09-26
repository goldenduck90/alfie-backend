import { Arg, Authorized, Mutation, Query, Resolver } from "type-graphql"
import { ApolloError } from "apollo-server"
import Role from "../schema/enums/Role"
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
import lookupCPID from "../utils/lookupCPID"
import resolveCPIDEntriesToInsurance from "../utils/resolveCPIDEntriesToInsurance"
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

  @Authorized([Role.Admin, Role.Patient])
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

  @Authorized([Role.Admin, Role.Patient])
  @Query(() => InsuranceEligibilityResponse)
  async insuranceEligibility(
    @Arg("checkoutId", () => String)
    checkoutId: string,
    @Arg("insurance", () => Insurance)
    insurance: Insurance,
    @Arg("cpid", { nullable: true }) cpid?: string
  ): Promise<InsuranceEligibilityResponse> {
    let inputs = []
    if (cpid) {
      inputs = [{ insurance, cpid }]
    } else {
      const cpids = lookupCPID(insurance.payor, insurance.insuranceCompany, 10)
      inputs = resolveCPIDEntriesToInsurance(cpids, insurance)
    }

    const user = await this.insuranceService.getCheckoutUserBasicInfo(
      checkoutId
    )
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

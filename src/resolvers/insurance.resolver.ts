import { Arg, Authorized, Mutation, Query, Resolver } from "type-graphql"
import { ApolloError } from "apollo-server"
import Role from "../schema/enums/Role"
import {
  InsurancePlanValue,
  InsuranceTypeValue,
  InsuranceCoveredResponse,
  BasicUserInsuranceInfo,
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

      const result = await this.insuranceFlow(
        input.insurancePlan,
        input.insuranceType,
        {
          state: checkout.state,
          dateOfBirth: checkout.dateOfBirth,
          gender: checkout.gender,
          name: checkout.name,
        },
        input.insurance
      )

      checkout.insurancePlan = input.insurancePlan
      checkout.insuranceType = input.insuranceType
      checkout.insurance = input.insurance
      checkout.insuranceCovered =
        (result.covered.covered || result.covered.comingSoon) &&
        result.eligible.eligible
      await checkout.save()

      return result
    } catch (error) {
      throw new ApolloError(error.message, "ERROR")
    }
  }

  @Authorized([Role.Admin, Role.Patient])
  @Query(() => InsuranceCheckResponse)
  async insuranceFlow(
    @Arg("insurancePlan", () => InsurancePlanValue)
    insurancePlan: InsurancePlanValue,

    @Arg("insuranceType", () => InsuranceTypeValue)
    insuranceType: InsuranceTypeValue,

    @Arg("userData", () => BasicUserInsuranceInfo)
    user: BasicUserInsuranceInfo,

    @Arg("insurance", () => Insurance)
    insurance: Insurance,

    @Arg("cpid", { nullable: true })
    cpid?: string
  ): Promise<InsuranceCheckResponse> {
    const covered = await this.insuranceCovered(
      insurancePlan,
      insuranceType,
      user
    )
    const eligible = await this.insuranceEligibility(user, insurance, cpid)

    return {
      covered,
      eligible,
    }
  }

  @Authorized([Role.Admin, Role.Patient])
  @Query(() => InsuranceCoveredResponse)
  async insuranceCovered(
    @Arg("insurancePlan", () => InsurancePlanValue)
    insurancePlan: InsurancePlanValue,

    @Arg("insuranceType", () => InsuranceTypeValue)
    insuranceType: InsuranceTypeValue,

    @Arg("userData", () => BasicUserInsuranceInfo)
    user: BasicUserInsuranceInfo
  ): Promise<InsuranceCoveredResponse> {
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
    @Arg("userData", () => BasicUserInsuranceInfo)
    user: BasicUserInsuranceInfo,
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

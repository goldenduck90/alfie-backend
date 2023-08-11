import { Arg, Authorized, Mutation, Query, Resolver } from "type-graphql"
import Role from "../schema/enums/Role"
import {
  InsurancePlanValue,
  InsuranceTypeValue,
  InsuranceCoveredResponse,
  BasicUserInsuranceInfo,
  InsurancePlansResponse,
  InsuranceFlowResponse,
} from "../schema/insurance.schema"
import CandidService from "../services/candid.service"
import InsuranceService from "../services/insurance.service"
import { Insurance, InsuranceEligibilityResponse } from "../schema/user.schema"
import lookupCPID from "../utils/lookupCPID"
import resolveCPIDEntriesToInsurance from "../utils/resolveCPIDEntriesToInsurance"
import UserService from "../services/user.service"

@Resolver()
export default class InsuranceResolver {
  private candidService: CandidService
  private insuranceService: InsuranceService
  private userService: UserService

  constructor() {
    this.candidService = new CandidService()
    this.insuranceService = new InsuranceService()
    this.userService = new UserService()
  }

  @Authorized([Role.Admin, Role.Patient])
  @Query(() => InsuranceFlowResponse)
  async insuranceFlowCheckout(
    @Arg("checkoutId") checkoutId: string
  ): Promise<InsuranceFlowResponse> {
    const { checkout } = await this.userService.getCheckout(checkoutId)

    const result = await this.insuranceFlow(
      checkout.insurancePlan,
      checkout.insuranceType,
      {
        address: checkout.billingAddress,
        dateOfBirth: checkout.dateOfBirth,
        gender: checkout.gender,
        name: checkout.name,
      },
      checkout.insurance
    )

    return result
  }

  @Authorized([Role.Admin, Role.Patient])
  @Query(() => InsuranceFlowResponse)
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
  ): Promise<InsuranceFlowResponse> {
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
      state: user.address.state,
    })

    return covered
  }

  @Authorized([Role.Admin, Role.Patient])
  @Mutation(() => InsuranceEligibilityResponse)
  async insuranceEligibility(
    @Arg("userData", () => BasicUserInsuranceInfo)
    user: BasicUserInsuranceInfo,
    @Arg("insurance", () => Insurance)
    insurance: Insurance,
    @Arg("cpid", { nullable: true }) cpid?: string
  ): Promise<InsuranceEligibilityResponse> {
    let inputs: ReturnType<typeof resolveCPIDEntriesToInsurance> = []
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

  @Authorized([Role.Admin, Role.Patient])
  @Query(() => InsurancePlansResponse)
  async insurancePlans() {
    const plans = await this.insuranceService.getPlans()
    const types = await this.insuranceService.getPlanTypes()

    return { plans, types }
  }
}

import { Arg, Authorized, Mutation, Query, Resolver } from "type-graphql"
import Role from "../schema/enums/Role"
import {
  InsurancePlanValue,
  InsuranceTypeValue,
  InsuranceCoveredResponse,
  InsuranceFlowResponse,
  BasicUserInsuranceInfo,
  InsurancePlansResponse,
} from "../schema/insurance.schema"
import CandidService from "../services/candid.service"
import InsuranceService from "../services/insurance.service"
import { Insurance, InsuranceEligibilityResponse } from "../schema/user.schema"
import lookupCPID from "../utils/lookupCPID"
import resolveCPIDEntriesToInsurance from "../utils/resolveCPIDEntriesToInsurance"
import PartnerService from "../services/partner.service"
import { ApolloError } from "apollo-server-errors"

@Resolver()
export default class InsuranceResolver {
  private candidService: CandidService
  private insuranceService: InsuranceService
  private partnerService: PartnerService

  constructor() {
    this.candidService = new CandidService()
    this.insuranceService = new InsuranceService()
    this.partnerService = new PartnerService()
  }

  @Authorized([Role.Admin, Role.Patient])
  @Mutation(() => InsuranceFlowResponse)
  async insuranceFlow(
    @Arg("insurancePlan", () => InsurancePlanValue)
    insurancePlan: InsurancePlanValue,
    @Arg("insuranceType", () => InsuranceTypeValue)
    insuranceType: InsuranceTypeValue,
    @Arg("insurance", () => Insurance)
    insurance: Insurance,
    @Arg("userData", () => BasicUserInsuranceInfo)
    user: BasicUserInsuranceInfo,
    @Arg("signupPartnerTitle", { nullable: true })
    signupPartnerTitle: string | null
  ): Promise<InsuranceFlowResponse> {
    const partner = signupPartnerTitle
      ? await this.partnerService.getSignupPartnerByTitle(signupPartnerTitle)
      : null
    if (signupPartnerTitle && !partner) {
      throw new ApolloError(
        `SignupPartner for ${signupPartnerTitle} not found.`,
        "NOT_FOUND"
      )
    }

    const cpids = lookupCPID(insurance.payor, insurance.insuranceCompany, 10)
    const inputs = resolveCPIDEntriesToInsurance(cpids, insurance)
    const eligible = await this.candidService.checkInsuranceEligibility(
      user,
      inputs
    )

    const covered = await this.insuranceService.isCovered({
      plan: insurancePlan,
      type: insuranceType,
      state: user.address.state,
    })

    return {
      covered,
      eligible,
      rectifiedInsurance: eligible.rectifiedInsurance,
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

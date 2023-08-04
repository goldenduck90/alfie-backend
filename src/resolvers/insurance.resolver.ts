import { Arg, Authorized, Query, Resolver } from "type-graphql"
import Role from "../schema/enums/Role"
import {
  InsurancePlanValue,
  InsuranceTypeValue,
  InsuranceCoveredResponse,
} from "../schema/insurance.schema"
import CandidService from "../services/candid.service"
import InsuranceService from "../services/insurance.service"
import UserService from "../services/user.service"
import { Insurance, InsuranceEligibilityResponse } from "../schema/user.schema"

@Resolver()
export default class InsuranceResolver {
  private userService: UserService
  private candidService: CandidService
  private insuranceService: InsuranceService

  constructor() {
    this.userService = new UserService()
    this.candidService = new CandidService()
    this.insuranceService = new InsuranceService()
  }

  @Authorized([Role.Admin, Role.Patient])
  @Query(() => InsuranceCoveredResponse)
  async insuranceCovered(
    @Arg("insurancePlan", () => InsurancePlanValue)
    insurancePlan: InsurancePlanValue,

    @Arg("insuranceType", () => InsuranceTypeValue)
    insuranceType: InsuranceTypeValue
  ): Promise<InsuranceCoveredResponse> {
    const covered = await this.insuranceService.isCovered(
      insurancePlan,
      insuranceType
    )
    return covered
  }

  @Authorized([Role.Admin, Role.Patient])
  @Query(() => InsuranceEligibilityResponse)
  async insuranceEligibility(
    @Arg("userId") userId: string,
    @Arg("input") input: Insurance
  ): Promise<InsuranceEligibilityResponse> {
    const user = await this.userService.getUser(userId)

    const eligible = await this.userService.checkInsuranceEligibilityFromData(
      input,
      user._id.toString()
    )

    return eligible
  }
}

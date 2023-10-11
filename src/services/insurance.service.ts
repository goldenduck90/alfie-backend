import {
  InsuranceStatus,
  InsuranceType,
  InsuranceModel,
  InsuranceDetails,
  InsuranceCheckResponse,
  Insurance,
} from "../schema/insurance.schema"
import { CheckoutModel } from "../schema/checkout.schema"
import CandidService, { BasicUserInfo } from "./candid.service"

export default class InsuranceService {
  private candidService: CandidService

  constructor() {
    this.candidService = new CandidService()
  }

  /** Whether the given plan and insurance type are covered. */
  async checkInsurance({
    user,
    insurance,
  }: {
    user: BasicUserInfo
    insurance: InsuranceDetails
  }): Promise<InsuranceCheckResponse> {
    try {
      const dbInsurance = await this.getInsuranceCoverage({
        insuranceId: insurance.insurance.toString(),
        insuranceType: insurance.type,
        state: user.state,
      })

      const { eligible, errors, payor } =
        await this.candidService.checkInsuranceEligibility({
          user,
          insurance,
          cpid: dbInsurance.cpid,
        })

      return {
        status: dbInsurance.insuranceStatus,
        eligible,
        payor,
        errors,
      }
    } catch (err: any) {
      if (err.message) {
        return {
          status: InsuranceStatus.NOT_ACTIVE,
          eligible: false,
          errors: [err.message],
        }
      }

      return {
        status: InsuranceStatus.NOT_ACTIVE,
        eligible: false,
        errors: ["UNKNOWN_ERROR"],
      }
    }
  }

  async getInsuranceCoverage({
    insuranceId,
    insuranceType,
    state,
  }: {
    insuranceId: string
    insuranceType: InsuranceType
    state: string
  }) {
    const insurance = await InsuranceModel.findOne({ _id: insuranceId })

    if (!insurance) {
      throw Error("INSURANCE_NOT_FOUND")
    }

    const insuranceState = insurance.states.find((i) => i.state === state)
    if (!insuranceState) {
      throw Error("INSURANCE_STATE_NOT_ACCEPTED")
    }

    if (insuranceState.status === InsuranceStatus.NOT_ACTIVE) {
      throw Error("INSURANCE_STATE_NOT_ACCEPTED")
    }

    if (!insuranceState.types.includes(insuranceType)) {
      throw Error("INSURANCE_TYPE_NOT_ACCEPTED")
    }

    return {
      insuranceId: insurance._id,
      insuranceStatus: insuranceState.status,
      cpid: insuranceState.cpid,
    }
  }

  async getCheckoutUserBasicInfo(checkoutId: string): Promise<BasicUserInfo> {
    const checkout = await CheckoutModel.findById(checkoutId)
    return {
      state: checkout.state,
      dateOfBirth: checkout.dateOfBirth,
      gender: checkout.gender,
      name: checkout.name,
    }
  }

  async getInsurances(): Promise<Insurance[]> {
    const insurances = await InsuranceModel.find()
    return insurances
  }
}

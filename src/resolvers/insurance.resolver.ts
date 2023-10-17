import { Arg, Mutation, Query, Resolver } from "type-graphql"
import { ApolloError } from "apollo-server"
import {
  Insurance,
  InsuranceCheckInput,
  InsuranceCheckResponse,
} from "../schema/insurance.schema"
import InsuranceService from "../services/insurance.service"
import { CheckoutModel } from "../schema/checkout.schema"

@Resolver()
export default class InsuranceResolver {
  private insuranceService: InsuranceService

  constructor() {
    this.insuranceService = new InsuranceService()
  }

  @Mutation(() => InsuranceCheckResponse)
  async insuranceCheck(
    @Arg("input") input: InsuranceCheckInput
  ): Promise<InsuranceCheckResponse> {
    try {
      const checkout = await CheckoutModel.findById(input.checkoutId)

      const result = await this.insuranceService.checkInsurance({
        user: {
          name: checkout.name,
          dateOfBirth: checkout.dateOfBirth,
          gender: checkout.gender,
          state: checkout.state,
        },
        insurance: input.insurance,
      })

      if (result.eligible) {
        checkout.insurance = {
          insurance: input.insurance.insuranceId,
          memberId: input.insurance.memberId,
          groupId: input.insurance.groupId,
          type: input.insurance.type,
          rxBIN: input.insurance.rxBIN,
          rxPCN: input.insurance.rxPCN,
          rxGroup: input.insurance.rxGroup,
          status: result.status,
          payorId: result.payor?.payorId,
          payorName: result.payor?.payorName,
          primary: result.primary,
          dependents: result.dependents,
        }

        if (result.provider) {
          checkout.provider = result.provider._id
        }

        await checkout.save()
      }

      return {
        status: result.status,
        eligible: result.eligible,
        errors: result.errors,
      }
    } catch (error) {
      throw new ApolloError(error.message, "ERROR")
    }
  }

  @Query(() => [Insurance])
  async insurances() {
    const insurances = await this.insuranceService.getInsurances()
    return insurances
  }
}

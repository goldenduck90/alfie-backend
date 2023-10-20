import { Arg, Mutation, Query, Resolver } from "type-graphql"
import { ApolloError } from "apollo-server"
import {
  Insurance,
  InsuranceCheckByCheckoutInput,
  InsuranceCheckByUserInput,
  InsuranceCheckResponse,
} from "../schema/insurance.schema"
import InsuranceService from "../services/insurance.service"
import { CheckoutModel } from "../schema/checkout.schema"
import { UserModel } from "../schema/user.schema"

@Resolver()
export default class InsuranceResolver {
  private insuranceService: InsuranceService

  constructor() {
    this.insuranceService = new InsuranceService()
  }

  @Mutation(() => InsuranceCheckResponse)
  async insuranceCheckByCheckout(
    @Arg("input") input: InsuranceCheckByCheckoutInput
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

  @Mutation(() => InsuranceCheckResponse)
  async insuranceCheckByUser(
    @Arg("input") input: InsuranceCheckByUserInput
  ): Promise<InsuranceCheckResponse> {
    try {
      const user = await UserModel.findById(input.userId)

      const result = await this.insuranceService.checkInsurance({
        user: {
          name: user.name,
          dateOfBirth: user.dateOfBirth,
          gender: user.gender,
          state: user.address.state,
        },
        insurance: input.insurance,
      })

      if (result.eligible) {
        user.insurance = {
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
          user.provider = result.provider._id
        }

        await user.save()
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

import CheckoutService from "../services/checkout.service"
import { Arg, Mutation, Query, Resolver } from "type-graphql"
import {
  CheckoutResponse,
  CreateCheckoutInput,
  CreateStripeCustomerInput,
} from "../schema/checkout.schema"
@Resolver()
export default class CheckoutResolver {
  constructor(private checkoutService: CheckoutService) {
    this.checkoutService = new CheckoutService()
  }

  @Mutation(() => CheckoutResponse)
  createOrFindCheckout(@Arg("input") input: CreateCheckoutInput) {
    return this.checkoutService.createOrFindCheckout(input)
  }

  @Mutation(() => CheckoutResponse)
  createOrUpdateStripeSession(@Arg("input") input: CreateStripeCustomerInput) {
    return this.checkoutService.createStripeCheckoutSession(input)
  }

  @Query(() => CheckoutResponse)
  checkout(@Arg("id") id: string) {
    return this.checkoutService.getCheckout(id)
  }
}

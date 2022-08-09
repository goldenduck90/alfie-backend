import CheckoutService from "../services/checkout.service"
import { Arg, Mutation, Resolver } from "type-graphql"
import {
  CheckoutResponse,
  CreateCheckoutInput,
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
}

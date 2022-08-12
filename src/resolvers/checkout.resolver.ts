import CheckoutService from "../services/checkout.service"
import { Arg, Authorized, Mutation, Query, Resolver } from "type-graphql"
import {
  CheckoutResponse,
  CompleteCheckoutInput,
  CreateCheckoutInput,
} from "../schema/checkout.schema"
import { MessageResponse, Role } from "../schema/user.schema"

@Resolver()
export default class CheckoutResolver {
  constructor(private checkoutService: CheckoutService) {
    this.checkoutService = new CheckoutService()
  }

  @Mutation(() => CheckoutResponse)
  createOrFindCheckout(@Arg("input") input: CreateCheckoutInput) {
    return this.checkoutService.createOrFindCheckout(input)
  }

  @Authorized([Role.Admin])
  @Mutation(() => MessageResponse)
  completeCheckout(@Arg("input") input: CompleteCheckoutInput) {
    return this.checkoutService.completeCheckout(input)
  }

  @Query(() => CheckoutResponse)
  checkout(@Arg("id") id: string) {
    return this.checkoutService.getCheckout(id)
  }
}

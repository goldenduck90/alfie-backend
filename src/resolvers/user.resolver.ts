import { UserTask } from "../schema/task.user.schema"
import { Arg, Authorized, Ctx, Mutation, Query, Resolver } from "type-graphql"
import {
  CompletePaymentIntentInput,
  CreateUserInput,
  ForgotPasswordInput,
  LoginInput,
  LoginResponse,
  MessageResponse,
  ResetPasswordInput,
  Role,
  SubscribeEmailInput,
  UpdateSubscriptionInput,
  User,
} from "../schema/user.schema"
import UserService from "../services/user.service"
import Context from "../types/context"
import {
  CreateCheckoutInput,
  CreateStripeCustomerInput,
  CheckoutResponse,
} from "../schema/checkout.schema"

@Resolver()
export default class UserResolver {
  constructor(private userService: UserService) {
    this.userService = new UserService()
  }

  @Authorized([Role.Admin])
  @Mutation(() => User)
  createUser(@Arg("input") input: CreateUserInput) {
    return this.userService.createUser(input)
  }

  @Mutation(() => LoginResponse) // returns the jwt
  login(@Arg("input") input: LoginInput) {
    return this.userService.login(input)
  }

  @Mutation(() => MessageResponse)
  forgotPassword(@Arg("input") input: ForgotPasswordInput) {
    return this.userService.forgotPassword(input)
  }

  @Mutation(() => LoginResponse)
  resetPassword(@Arg("input") input: ResetPasswordInput) {
    return this.userService.resetPassword(input)
  }

  @Mutation(() => MessageResponse)
  subscribeEmail(@Arg("input") input: SubscribeEmailInput) {
    return this.userService.subscribeEmail(input)
  }

  @Authorized([Role.Admin])
  @Mutation(() => MessageResponse)
  async completePaymentIntent(@Arg("input") input: CompletePaymentIntentInput) {
    return this.userService.completePaymentIntent(input)
  }

  @Authorized([Role.Admin])
  @Mutation(() => MessageResponse)
  async updateSubscription(@Arg("input") input: UpdateSubscriptionInput) {
    return this.userService.updateSubscription(input)
  }

  @Query(() => User)
  me(@Ctx() context: Context) {
    return this.userService.getUser(context.user._id)
  }

  @Query(() => User)
  user(@Ctx() context: Context) {
    return this.userService.getUser(context.user._id)
  }

  @Authorized([Role.Admin])
  @Query(() => [User])
  users() {
    return this.userService.getAllUsers()
  }

  @Authorized([Role.Practitioner, Role.Doctor, Role.Admin])
  // Query returns an array of User and a custom field called tasks
  @Query(() => [User])
  getAllPatientsByPractitioner(@Ctx() context: Context) {
    return this.userService.getAllUsersByAProvider(context.user._id)
  }
  @Authorized([Role.Doctor, Role.Admin, Role.Practitioner])
  @Query(() => [UserTask])
  getAllUserTasksByUser(@Arg("userId") userId: string) {
    return this.userService.getAllUserTasksByUser(userId)
  }

  @Mutation(() => CheckoutResponse)
  createOrFindCheckout(@Arg("input") input: CreateCheckoutInput) {
    return this.userService.createOrFindCheckout(input)
  }

  @Mutation(() => CheckoutResponse)
  createOrUpdateStripeSession(@Arg("input") input: CreateStripeCustomerInput) {
    return this.userService.createStripeCheckoutSession(input)
  }

  @Query(() => CheckoutResponse)
  checkout(@Arg("id") id: string) {
    return this.userService.getCheckout(id)
  }
}

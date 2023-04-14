import { Arg, Authorized, Ctx, Mutation, Query, Resolver } from "type-graphql"
import { CreateLabOrderResponse } from "../schema/akute.schema"
import {
  CheckoutResponse,
  CreateCheckoutInput,
  CreateStripeCustomerInput,
} from "../schema/checkout.schema"
import { UserTask } from "../schema/task.user.schema"
import {
  CompletePaymentIntentInput,
  CreateUserInput,
  ForgotPasswordInput,
  LoginInput,
  LoginResponse,
  MessageResponse,
  ResetPasswordInput,
  Role,
  Score,
  SubscribeEmailInput,
  UpdateSubscriptionInput,
  User,
  UserSendbirdChannel,
} from "../schema/user.schema"
import AkuteService from "../services/akute.service"
import UserService from "../services/user.service"
import Context from "../types/context"

@Resolver()
export default class UserResolver {
  constructor(
    private userService: UserService,
    private akuteService: AkuteService
  ) {
    this.userService = new UserService()
    this.akuteService = new AkuteService()
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

  @Authorized([Role.Doctor, Role.Admin, Role.Practitioner, Role.HealthCoach])
  @Query(() => User)
  generateSummary(@Arg("userId") userId: string) {
    return this.userService.generateProtocolSummary(userId)
  }

  @Query(() => User)
  user(@Ctx() context: Context) {
    return this.userService.getUser(context.user._id)
  }

  @Query(() => User)
  getUserById(@Arg("userId") userId: string) {
    return this.userService.getUser(userId)
  }

  @Authorized([Role.Admin])
  @Query(() => [User])
  users() {
    return this.userService.getAllUsers()
  }

  @Authorized([Role.Practitioner, Role.Doctor, Role.Admin, Role.HealthCoach])
  // Query returns an array of User and a custom field called tasks
  @Query(() => [User])
  getAllPatientsByPractitioner(@Ctx() context: Context) {
    return this.userService.getAllUsersByAProvider(context.user._id)
  }
  @Authorized([Role.Practitioner, Role.Doctor, Role.Admin, Role.HealthCoach])
  // Query returns an array of User and a custom field called tasks
  @Query(() => [User])
  getAllPatientsByHealthCoach(@Ctx() context: Context) {
    return this.userService.getAllUsersByAHealthCoach(context.user._id)
  }
  @Authorized([Role.Doctor, Role.Admin, Role.Practitioner, Role.HealthCoach])
  @Query(() => [UserTask])
  getAllUserTasksByUser(@Arg("userId") userId: string) {
    return this.userService.getAllUserTasksByUser(userId)
  }

  @Authorized([Role.Admin, Role.Doctor, Role.Practitioner, Role.HealthCoach])
  @Mutation(() => User)
  classifyPatients(@Arg("userId") userId: string) {
    return this.userService.classifyPatient(userId)
  }

  @Authorized([Role.Admin, Role.Doctor, Role.Practitioner, Role.HealthCoach])
  @Mutation(() => Score)
  scorePatients(@Arg("userId") userId: string) {
    return this.userService.scorePatient(userId)
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

  @Mutation(() => CreateLabOrderResponse)
  createLabOrder(@Arg("userId") userId: string) {
    return this.akuteService.createLabOrder(userId)
  }

  @Authorized([
    Role.Admin,
    Role.Practitioner,
    Role.CareCoordinator,
    Role.Doctor,
  ])
  @Query(() => [UserSendbirdChannel])
  userSendbirdChannel(@Arg("userId") userId: string) {
    return this.userService.sendbirdChannels(userId)
  }
}

import { Arg, Authorized, Ctx, Mutation, Query, Resolver } from "type-graphql"
import { CreateLabOrderResponse } from "../schema/akute.schema"
import { MetriportConnectResponse } from "../schema/metriport.schema"
import {
  CheckoutResponse,
  CreateCheckoutInput,
  CheckoutAddressInput,
} from "../schema/checkout.schema"
import { UserTask } from "../schema/task.user.schema"
import {
  CreateUserInput,
  ForgotPasswordInput,
  LoginInput,
  LoginResponse,
  MessageResponse,
  ResetPasswordInput,
  RoleResponse,
  SubscribeEmailInput,
  User,
  UserSendbirdChannel,
  ScaleReadingInput,
} from "../schema/user.schema"
import Role from "../schema/enums/Role"
import AkuteService from "../services/akute.service"
import UserService from "../services/user.service"
import MetriportService from "../services/metriport.service"
import Context from "../types/context"

@Resolver()
export default class UserResolver {
  private userService: UserService
  private akuteService: AkuteService
  private metriportService: MetriportService

  constructor() {
    this.userService = new UserService()
    this.akuteService = new AkuteService()
    this.metriportService = new MetriportService()
  }

  @Authorized([Role.Admin])
  @Mutation(() => User)
  async createUser(@Arg("input") input: CreateUserInput) {
    const { user } = await this.userService.createUser(input)
    return user
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

  @Query(() => User)
  me(@Ctx() context: Context) {
    return this.userService.getUser(context.user._id)
  }

  @Query(() => RoleResponse)
  getRole(@Ctx() context: Context) {
    return { role: context.user.role }
  }

  @Authorized([
    Role.Doctor,
    Role.Admin,
    Role.Practitioner,
    Role.HealthCoach,
    Role.CareCoordinator,
  ])
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

  @Authorized([Role.Admin, Role.HealthCoach, Role.CareCoordinator])
  @Query(() => [User])
  users() {
    return this.userService.getAllUsers()
  }

  @Authorized([
    Role.Practitioner,
    Role.Doctor,
    Role.HealthCoach,
    Role.CareCoordinator,
  ])
  // Query returns an array of User and a custom field called tasks
  @Query(() => [User])
  getAllPatientsByProvider(@Ctx() context: Context) {
    return this.userService.getAllUsersByAProvider(context.user._id)
  }

  @Authorized([
    Role.Practitioner,
    Role.Doctor,
    Role.HealthCoach,
    Role.CareCoordinator,
  ])
  // Query returns an array of User and a custom field called tasks
  @Query(() => [User])
  getAllPatientsWithAlerts(@Ctx() context: Context) {
    return this.userService.getAllUsersWithAlerts(context.user._id)
  }

  @Authorized([
    Role.Practitioner,
    Role.Doctor,
    Role.Admin,
    Role.HealthCoach,
    Role.CareCoordinator,
  ])
  // Query returns an array of User and a custom field called tasks
  @Query(() => [User])
  getAllPatientsByHealthCoach() {
    return this.userService.getAllUsersByAHealthCoach()
  }

  @Authorized([
    Role.Doctor,
    Role.Admin,
    Role.Practitioner,
    Role.HealthCoach,
    Role.CareCoordinator,
  ])
  @Query(() => [UserTask])
  getAllUserTasksByUser(@Arg("userId") userId: string) {
    return this.userService.getAllUserTasksByUser(userId)
  }

  @Mutation(() => CheckoutResponse)
  createOrFindCheckout(@Arg("input") input: CreateCheckoutInput) {
    return this.userService.createOrFindCheckout(input)
  }

  @Mutation(() => CheckoutResponse)
  createOrUpdateStripeSession(@Arg("input") input: CheckoutAddressInput) {
    return this.userService.createStripeCheckoutSession(input)
  }

  @Mutation(() => CheckoutResponse)
  createInsuredUserFromCheckout(@Arg("input") input: CheckoutAddressInput) {
    return this.userService.createInsuredUserFromCheckout(input)
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

  @Mutation(() => MetriportConnectResponse)
  generateMetriportConnectUrl(@Arg("userId") userId: string) {
    return this.metriportService.createConnectToken(userId)
  }

  @Mutation(() => String)
  createUserFromCheckout(@Arg("checkoutId") checkoutId: string) {
    return this.userService.createUserFromCheckout(checkoutId)
  }

  @Mutation(() => User)
  async recordScaleReading(@Arg("input") input: ScaleReadingInput) {
    const { user } = await this.userService.processWithingsScaleReading(
      input.metriportUserId,
      input.weightLbs,
      input.time
    )
    return user
  }
}

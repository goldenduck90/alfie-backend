import { Arg, Authorized, Ctx, Mutation, Query, Resolver } from "type-graphql"
import {
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
  async updateSubscription(@Arg("input") input: UpdateSubscriptionInput) {
    return this.userService.updateSubscription(input)
  }

  @Query(() => User, { nullable: true })
  me(@Ctx() context: Context) {
    return context.user
  }
}

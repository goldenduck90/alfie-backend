import { Arg, Authorized, Ctx, Mutation, Query, Resolver } from "type-graphql"
import {
  CreateUserInput,
  LoginInput,
  LoginResponse,
  Role,
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

  @Query(() => User, { nullable: true })
  me(@Ctx() context: Context) {
    return context.user
  }
}

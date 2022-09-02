import Context from "../types/context"
import { MiddlewareFn } from "type-graphql"
import { Role, UserModel } from "../schema/user.schema"
import { ApolloError } from "apollo-server"

export const SubscriptionChecker: MiddlewareFn<Context> = async (
  { context },
  next
) => {
  if (!context.user) {
    throw new ApolloError("Not authenticated", "NOT_AUTHORIZED")
  } else if (
    context.user.role === Role.Admin ||
    context.user.role === Role.Practitioner ||
    context.user.role === Role.Doctor
  ) {
    next()
  } else {
    const { user } = context
    const dbUser = await UserModel.findById(user._id).lean()
    if (!dbUser) throw new ApolloError("User not found", "NOT FOUND")

    if (dbUser.subscriptionExpiresAt > new Date()) {
      next()
    } else {
      throw new ApolloError("Subscription expired", "SUBSCRIPTION_EXPIRED")
    }
  }
}

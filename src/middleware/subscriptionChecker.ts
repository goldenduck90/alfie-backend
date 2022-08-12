import Context from "../types/context"
import { MiddlewareFn } from "type-graphql"
import { Role, UserModel } from "../schema/user.schema"
import { ApolloError } from "apollo-server"

export const SubscriptionChecker: MiddlewareFn<Context> = async (
  { context },
  next
) => {
  if (!context.user) next()
  if (context.user.role === Role.Admin || context.user.role === Role.Clinician)
    next()

  const { user } = context
  const dbUser = await UserModel.findById(user._id).lean()
  if (!dbUser) next()

  if (dbUser.subscriptionExpiresAt > new Date()) {
    next()
  }

  throw new ApolloError("Subscription expired", "SUBSCRIPTION_EXPIRED")
}

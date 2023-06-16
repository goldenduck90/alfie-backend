import { AuthChecker } from "type-graphql"
import Context from "../types/context"
import Role from "../schema/enums/Role"

const authChecker: AuthChecker<Context> = ({ context }, roles: Role[]) => {
  // here we can read the user from context
  // and check his permission in the db against the `roles` argument
  // that comes from the `@Authorized` decorator, eg. ["ADMIN", "MODERATOR"]
  if (!context.user) {
    return false
  }

  // if context.user is set, and none of the roles is set, allow access
  if (roles.length === 0) {
    return true
  }

  // if admin, allow any action
  if (context.user.role === Role.Admin) {
    return true
  }

  // if user has one of the roles, allow user to access the route
  if (roles.includes(context.user.role)) {
    return true
  }

  return false
}

export default authChecker

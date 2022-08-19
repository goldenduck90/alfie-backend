import UserResolver from "./user.resolver"
import CheckoutResolver from "./checkout.resolver"
import TaskResolver from "./task.resolver"

export default [UserResolver, CheckoutResolver, TaskResolver] as const

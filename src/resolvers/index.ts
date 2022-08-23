import UserResolver from "./user.resolver"
import CheckoutResolver from "./checkout.resolver"
import TaskResolver from "./task.resolver"
import UploadResolver from "./upload.resolver"

export default [
  UserResolver,
  CheckoutResolver,
  TaskResolver,
  UploadResolver,
] as const

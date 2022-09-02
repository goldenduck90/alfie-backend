import UserResolver from "./user.resolver"
import CheckoutResolver from "./checkout.resolver"
import TaskResolver from "./task.resolver"
import UploadResolver from "./upload.resolver"
import AppointmentResolver from "./appointment.resolver"

export default [
  UserResolver,
  CheckoutResolver,
  TaskResolver,
  UploadResolver,
  AppointmentResolver,
] as const

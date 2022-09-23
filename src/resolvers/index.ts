import UserResolver from "./user.resolver"
import CheckoutResolver from "./checkout.resolver"
import TaskResolver from "./task.resolver"
import UploadResolver from "./upload.resolver"
import AppointmentResolver from "./appointment.resolver"
import GooglePlacesResolver from "./googlePlaces.resolver"

export default [
  UserResolver,
  CheckoutResolver,
  TaskResolver,
  UploadResolver,
  AppointmentResolver,
  GooglePlacesResolver,
] as const

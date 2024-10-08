import AddressAutocompleteResolver from "./address.resolver"
import UserResolver from "./user.resolver"
import TaskResolver from "./task.resolver"
import UploadResolver from "./upload.resolver"
import AppointmentResolver from "./appointment.resolver"
import GooglePlacesResolver from "./googlePlaces.resolver"
import ProviderResolver from "./provider.resolver"
import FileResolver from "./file.resolver"
import PartnerResolver from "./partner.resolver"
import InternalResolver from "./internal.resolver"
import InsuranceResolver from "./insurance.resolver"
import AlertResolver from "./alert.resolver"
import NPSResolver from "./NPS.resolver"

export default [
  AddressAutocompleteResolver,
  UserResolver,
  TaskResolver,
  UploadResolver,
  AppointmentResolver,
  GooglePlacesResolver,
  ProviderResolver,
  FileResolver,
  PartnerResolver,
  InternalResolver,
  InsuranceResolver,
  AlertResolver,
  NPSResolver,
] as const

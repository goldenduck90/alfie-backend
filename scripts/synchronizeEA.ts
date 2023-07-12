import runShell, { createProgram } from "./utils/runShell"
import Role from "../src/schema/enums/Role"
import { Provider } from "../src/schema/provider.schema"
import { UserModel } from "../src/schema/user.schema"
import AppointmentService from "../src/services/appointment.service"
import ProviderService from "../src/services/provider.service"
import UserService from "../src/services/user.service"
import { IEAProviderRequest } from "../src/@types/easyAppointmentTypes"
import { v4 as uuidv4 } from "uuid"

createProgram().description(
  "Synchronizes entities from the MongoDB database to the EA MySQL database."
)

runShell(() => synchronizeEA())

async function synchronizeEA() {
  const appointmentService = new AppointmentService()
  const userService = new UserService()
  const providerService = new ProviderService()

  // Synchronize providers
  const providers = await providerService.listProviders()

  for (const provider of providers) {
    console.log(`Synchronizing provider: ${provider._id} ${provider.email}`)
    const eaProvider = await appointmentService.getProvider(
      String(provider.eaProviderId)
    )

    const toEAProvider = (
      p: Provider,
      newEntry: boolean
    ): IEAProviderRequest => ({
      firstName: p.firstName,
      lastName: p.lastName,
      email: p.email,
      timezone: "America/New_York",
      minAdvancedNotice: 12,
      bufferTime: 0,
      type: [null, Role.Doctor, null, null, Role.HealthCoach].indexOf(p.type),
      numberOfPatients: 0,
      licensed_states: p.licensedStates.map((state) =>
        appointmentService.getStateId(state)
      ),
      notes: "",
      phone: "0000000000",
      settings: newEntry
        ? {
            password: uuidv4().slice(0, 10),
            username: `${p.firstName}-${p.lastName}-${p._id}`.toLowerCase(),
          }
        : {},
      services: [1],
    })

    if (eaProvider) {
      await appointmentService.updateProvider(
        String(eaProvider.id),
        toEAProvider(provider, false)
      )
      console.log(
        `- Synchronized provider/update ${provider._id.toString()}/${
          eaProvider.id
        }`
      )
    } else {
      const newProvider = await appointmentService.createProvider(
        toEAProvider(provider, true)
      )

      console.log(
        `- Synchronized provider/create ${provider._id.toString()}/${
          newProvider.id
        }`
      )

      if (newProvider && provider.eaProviderId !== newProvider.id) {
        provider.eaProviderId = newProvider.id
        await provider.save()
        console.log("   - Updated provider.eaProviderId")
      }
    }
  }

  // Synchronize Patients
  const users = await userService.getAllUsers()
  for (const user of users) {
    console.log(`Synchronizing user: ${user._id}`)
    const eaUser = await appointmentService.getCustomerByEmail(user.email)

    if (eaUser) {
      if (user.eaCustomerId !== String(eaUser.id)) {
        await UserModel.findByIdAndUpdate(user._id, {
          $set: { eaCustomerId: String(eaUser.id) },
        })
        user.eaCustomerId = String(eaUser.id)
        console.log(
          `- Synchronized patient/existing EA user ${user._id.toString()}/${
            eaUser.id
          }`
        )
      } else {
        console.log(`- User already synchronized: ${user._id}/${eaUser.id}`)
      }
    } else {
      const customerId = await appointmentService.createCustomer({
        userId: user._id.toString(),
        firstName: user.name.split(" ")[0] || "",
        lastName: user.name.split(" ")[1] || "",
        email: user.email,
        notes: "",
        address: user.address.line1,
        city: user.address.city,
        state: user.address.state,
        zipCode: user.address.postalCode,
        phone: user.phone,
        timezone: user.timezone,
        updateUser: true,
      })
      console.log(
        `- Synchronized patient/new EA user: ${user._id.toString()}/${customerId}`
      )
    }
  }
}

import { connectToMongo } from "./utils/mongo"
import { UserModel } from "./schema/user.schema"
import ProviderService from "./services/provider.service"

const providers = ["63cb17cc119c2a9593a21df5"]

const providerService = new ProviderService()

async function fixProviderPatientAssignment() {
  try {
    for (let i = 0; i < providers.length; i++) {
      const provider = providers[i]
      const patients = await UserModel.find({ provider })

      for (let j = 0; j < patients.length; j++) {
        const patient = patients[j]
        const newProvider = await providerService.getNextAvailableProvider(
          patient.address.state,
          false
        )

        patient.provider = newProvider._id
        await patient.save()

        newProvider.numberOfPatients = newProvider.numberOfPatients + 1
        await newProvider.save()

        console.log(`SUCCESSFULLY UPDATED PATIENT: ${patient._id}`)
        console.log(
          `SUCCESSFULLY INCREMENTED NUMBER OF PATIENTS FOR PROVIDER: ${newProvider._id}`
        )
      }
    }
  } catch (error) {
    console.log(error)
  }
}

connectToMongo()
fixProviderPatientAssignment()

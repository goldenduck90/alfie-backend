import { connectToMongo } from "./utils/mongo"
import { ProviderModel } from "./schema/provider.schema"
import { UserModel } from "./schema/user.schema"

async function fixProviderPatientCount() {
  try {
    const providers = await ProviderModel.find()

    for (let i = 0; i < providers.length; i++) {
      const provider = providers[i]

      const patientCount = await UserModel.find({
        provider: provider._id,
      }).count()

      provider.numberOfPatients = patientCount
      await provider.save()
    }
  } catch (error) {
    console.log(error)
  }
}

connectToMongo()
fixProviderPatientCount()

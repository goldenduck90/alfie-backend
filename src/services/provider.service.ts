import { ApolloError } from "apollo-server"
import {
  BatchCreateOrUpdateProvidersInput,
  ProviderModel,
} from "../schema/provider.schema"

class ProviderService {
  async getNextAvailableProvider(state: string, update = false) {
    const provider = await ProviderModel.find()
      .where("licensedStates")
      .in([state])
      .sort({ numberOfPatients: "asc" })
      .limit(1)

    if (provider.length === 0) {
      throw new ApolloError(
        `No providers available for state: ${state}`,
        "NOT_FOUND"
      )
    }

    if (update) {
      await ProviderModel.updateOne(
        { _id: provider[0]._id },
        { $inc: { numberOfPatients: 1 } }
      )
    }

    return provider[0]
  }

  async batchCreateOrUpdateProviders(input: BatchCreateOrUpdateProvidersInput) {
    const { providers } = input
    const bulkOps = providers.map((provider) => ({
      updateOne: {
        filter: {
          akuteId: provider.akuteId,
          eaProviderId: provider.eaProviderId,
        },
        update: provider,
        upsert: true,
      },
    }))
    const result = await ProviderModel.bulkWrite(bulkOps)

    return {
      updated: result.modifiedCount,
      created: result.upsertedCount,
    }
  }
}

export default ProviderService

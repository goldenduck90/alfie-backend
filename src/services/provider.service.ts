import { ApolloError } from "apollo-server"
import { v4 as uuidv4 } from "uuid"
import {
  BatchCreateOrUpdateProvidersInput,
  Provider,
  ProviderModel,
} from "../schema/provider.schema"
import { Role } from "./../schema/user.schema"
import EmailService from "./email.service"

class ProviderService {
  private emailService: EmailService

  constructor() {
    this.emailService = new EmailService()
  }

  async getNextAvailableProvider(state: string, update = false) {
    // Only return providers where the type === "Practitioner"
    const provider = await ProviderModel.find()
      .where("type")
      .equals("Practitioner")
      .where("licensedStates")
      .in([state])
      .sort({ numberOfPatients: "asc" })
      .limit(1)

    const providers = provider.filter((_provider: Provider) => {
      return _provider.type === Role.Practitioner
    })
    if (providers.length === 0) {
      throw new ApolloError(
        `No providers available for state: ${state}`,
        "NOT_FOUND"
      )
    }

    if (update) {
      await ProviderModel.updateOne(
        { _id: providers[0]._id },
        { $inc: { numberOfPatients: 1 } }
      )
    }

    return providers[0]
  }

  async batchCreateOrUpdateProviders(input: BatchCreateOrUpdateProvidersInput) {
    const { providers } = input
    console.error(input)
    console.log(providers)

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
    const providerIds = result.getUpsertedIds()

    const providersCreated = await ProviderModel.find({
      _id: { $in: providerIds },
    })

    for (const provider of providersCreated) {
      // create email token
      const emailToken = uuidv4()

      // update provider
      await ProviderModel.updateOne(
        { _id: provider._id },
        { $set: { emailToken } }
      )

      // send password email
      await this.emailService.sendRegistrationEmailTemplate({
        email: provider.email,
        token: emailToken,
        provider: true,
        name: `${provider.firstName} ${provider.lastName}`,
      })
    }

    return {
      updated: result.modifiedCount,
      created: result.upsertedCount,
    }
  }
}

export default ProviderService

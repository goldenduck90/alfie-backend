import { ApolloError } from "apollo-server"
import { v4 as uuidv4 } from "uuid"
import {
  BatchCreateOrUpdateProvidersInput,
  ProviderModel,
} from "../schema/provider.schema"
import { Role } from "./../schema/user.schema"
import EmailService from "./email.service"

class ProviderService {
  private emailService: EmailService

  constructor() {
    this.emailService = new EmailService()
  }

  async getProvider(email: string) {
    // const user = await UserModel.find().findByEmail(email).lean()

    // if (!user) {
    const provider = await ProviderModel.find().findByEmail(email).lean()
    if (!provider) {
      throw new ApolloError("Provider not found.", "NOT_FOUND")
    }
    // }
    if (!provider.calId) {
      throw new ApolloError("Provider cal id not found.", "NOT_FOUND")
    }

    return provider[0]
  }

  async getNextAvailableProvider(state: string, update = false) {
    // Only return providers where the type === "Practitioner"
    const provider = await ProviderModel.find()
      .where({
        type: Role.Practitioner,
      })
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

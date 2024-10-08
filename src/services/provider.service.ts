import { ApolloError } from "apollo-server"
import { createSendBirdUser } from "../utils/sendBird"
import { v4 as uuidv4 } from "uuid"
import {
  BatchCreateOrUpdateProvidersInput,
  ProviderModel,
} from "../schema/provider.schema"
import Role from "./../schema/enums/Role"
import EmailService from "./email.service"

class ProviderService {
  private emailService: EmailService

  constructor() {
    this.emailService = new EmailService()
  }

  async getProviderByEmail(email: string) {
    const provider = await ProviderModel.findOne({ email })
    if (provider) {
      return provider
    } else {
      throw new ApolloError("Provider not found.", "NOT_FOUND")
    }
  }

  async listProviders() {
    const providers = await ProviderModel.find()
    return providers
  }

  async getLeastBusyFromList(providerIds: string[], update = false) {
    // Only return providers where the type === "Practitioner"
    const providers = await ProviderModel.find({
      type: Role.Practitioner,
      _id: { $in: [providerIds] },
    })
      .sort({ numberOfPatients: "asc" })
      .limit(1)

    if (providers.length === 0) {
      throw new Error("NO_PROVIDERS")
    }

    const provider = providers[0]

    if (update) {
      provider.numberOfPatients = provider.numberOfPatients + 1
      await provider.save()
    }

    return provider
  }

  async getNextAvailableProvider(state: string, update = false) {
    // Only return providers where the type === "Practitioner"
    const providers = await ProviderModel.find({
      type: Role.Practitioner,
      licensedStates: { $in: [state] },
    })
      .sort({ numberOfPatients: "asc" })
      .limit(1)

    if (providers.length === 0) {
      throw new ApolloError(
        `No providers available for state: ${state}`,
        "NOT_FOUND"
      )
    }

    const provider = providers[0]

    if (update) {
      provider.numberOfPatients = provider.numberOfPatients + 1
      await provider.save()
    }

    return provider
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
    const providerIds = result.getUpsertedIds()

    const providersCreated = await ProviderModel.find({
      _id: { $in: providerIds },
    })

    for (const provider of providersCreated) {
      // create sendbird user
      const sendBirdId = await createSendBirdUser({
        user_id: provider._id,
        nickname: `${provider.firstName} ${provider.lastName}`,
        profile_url: "",
        profile_file: "",
      })
      if (!sendBirdId) {
        console.log(
          `Error occurred creating sendbird ID for provider: ${provider._id}`
        )
      }

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

  async getProviderById(providerId: string) {
    return ProviderModel.findById(providerId)
  }
}

export default ProviderService

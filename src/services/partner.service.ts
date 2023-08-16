import { ApolloError } from "apollo-server"
import {
  SignupPartner,
  SignupPartnerModel,
  SignupPartnerProvider,
  SignupPartnerProviderModel,
} from "../schema/partner.schema"

class PartnerService {
  async getSignupPartnerByTitle(title: string): Promise<{
    partner: SignupPartner | null
    partnerProviders: SignupPartnerProvider[] | null
  }> {
    try {
      const regex = new RegExp(["^", title, "$"].join(""), "i")
      const partner = await SignupPartnerModel.findOne({ title: regex })
      const partnerProviders = partner
        ? await SignupPartnerProviderModel.find({
            signupPartner: partner._id,
          })
        : null
      return {
        partner,
        partnerProviders,
      }
    } catch (err) {
      throw new ApolloError(err.message, "ERROR")
    }
  }

  async getSignupPartnerProviders(partnerId: string) {
    try {
      return await SignupPartnerProviderModel.find({ signupPartner: partnerId })
    } catch (err) {
      throw new ApolloError(err.message, "ERROR")
    }
  }
}

export default PartnerService

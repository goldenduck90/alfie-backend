import { ApolloError } from "apollo-server"
import {
  SignupPartnerModel,
  SignupPartnerProviderModel,
} from "../schema/partner.schema"

class PartnerService {
  async getSignupPartnerByTitle(title: string) {
    try {
      const regex = new RegExp(["^", title, "$"].join(""), "i")
      const partner = await SignupPartnerModel.findOne({ title: regex })
      const partnerProviders = await SignupPartnerProviderModel.find({
        signupPartner: partner._id,
      })
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

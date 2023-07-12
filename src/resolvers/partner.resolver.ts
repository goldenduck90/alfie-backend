import { Arg, Query, Resolver } from "type-graphql"
import { SignupPartner, SignupPartnerProvider } from "../schema/partner.schema"
import PartnerService from "../services/partner.service"

@Resolver()
export default class PartnerResolver {
  constructor(private partnerService: PartnerService) {
    this.partnerService = new PartnerService()
  }

  @Query(() => SignupPartner)
  getSignupPartnerByTitle(@Arg("title") title: string) {
    return this.partnerService.getSignupPartnerByTitle(title)
  }

  @Query(() => [SignupPartnerProvider])
  getSignupPartnerProviders(@Arg("partnerId") partnerId: string) {
    return this.partnerService.getSignupPartnerByTitle(partnerId)
  }
}

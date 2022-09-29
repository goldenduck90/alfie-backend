import {
  BatchCreateOrUpdateProvidersInput,
  BatchCreateOrUpdateProvidersResponse,
} from "../schema/provider.schema"
import { Arg, Authorized, Mutation, Resolver } from "type-graphql"
import { Role } from "../schema/user.schema"
import ProviderService from "../services/provider.service"

@Resolver()
export default class ProviderResolver {
  constructor(private providerService: ProviderService) {
    this.providerService = new ProviderService()
  }

  @Authorized([Role.Admin])
  @Mutation(() => BatchCreateOrUpdateProvidersResponse, { nullable: true })
  batchCreateOrUpdateProviders(
    @Arg("input") input: BatchCreateOrUpdateProvidersInput
  ) {
    return this.providerService.batchCreateOrUpdateProviders(input)
  }
}

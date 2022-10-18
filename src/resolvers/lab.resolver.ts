import { Arg, Authorized, Mutation, Query, Resolver } from "type-graphql"
import { Role } from "../schema/user.schema"
import LabService from "../services/lab.service"
import {
  BatchCreateOrUpdateLabsInput,
  BatchCreateOrUpdateLabsResponse,
} from "../schema/lab.schema"
import {
  GooglePlacesSearchResult,
  GooglePlacesSearchInput,
} from "../schema/googlePlaces.schema"

@Resolver()
export default class LabResolver {
  constructor(private labService: LabService) {
    this.labService = new LabService()
  }

  @Authorized([Role.Admin])
  @Mutation(() => BatchCreateOrUpdateLabsResponse, { nullable: true })
  batchCreateOrUpdateLabs(@Arg("input") input: BatchCreateOrUpdateLabsInput) {
    return this.labService.batchCreateOrUpdateLabs(input)
  }

  @Query(() => [GooglePlacesSearchResult])
  async labLocations(@Arg("input") input: GooglePlacesSearchInput) {
    return this.labService.getLocationsFromGoogleAutoComplete(input)
  }
}

import { Arg, Authorized, Mutation, Query, Resolver } from "type-graphql"
import {
  GooglePlacesSearchInput,
  GooglePlacesSearchResult,
} from "../schema/googlePlaces.schema"
import {
  BatchCreateOrUpdateLabsInput,
  BatchCreateOrUpdateLabsResponse,
  Lab,
} from "../schema/lab.schema"
import { Role } from "../schema/user.schema"
import LabService from "../services/lab.service"

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
  @Query(() => [Lab])
  async getLabLocations() {
    return this.labService.getAllLabLocations()
  }
}

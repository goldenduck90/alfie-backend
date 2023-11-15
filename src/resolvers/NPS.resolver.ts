import { Arg, Resolver, Query, Mutation } from "type-graphql"
import NPSService from "../services/NPS.service"
import { NPS, NPSInput } from "../schema/NPS.schema"

@Resolver()
export default class NPSResolver {
  private npsService: NPSService

  constructor() {
    this.npsService = new NPSService()
  }

  @Query(() => NPS)
  getSurvey(@Arg("id") id: string) {
    return this.npsService.getSurvey(id)
  }

  @Mutation(() => NPS)
  submitSurvey(@Arg("input") input: NPSInput) {
    return this.npsService.submitSurvey(input)
  }
}

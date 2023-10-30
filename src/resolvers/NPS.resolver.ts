import { Arg, Resolver, Mutation } from "type-graphql"
import NPSService from "../services/NPS.service"
import { NPS as NPSInput } from "../schema/NPS.schema"

@Resolver()
export default class NPSResolver {
  private npsService: NPSService

  constructor() {
    this.npsService = new NPSService()
  }

  @Mutation(() => NPSInput)
  createNPS(@Arg("input") input: NPSInput) {
    return this.npsService.createNPS(input)
  }
}

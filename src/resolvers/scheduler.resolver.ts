import CalSchedulerService from "../services/scheduler.service"
import { Arg, Authorized, Ctx, Query, Resolver } from "type-graphql"
import { Role } from "../schema/user.schema"
import { CalAvailability } from "../schema/scheduler.schema"

@Resolver()
export default class SchedulerResolver {
  constructor(private calSchedulerService: CalSchedulerService) {
    this.calSchedulerService = new CalSchedulerService()
  }

  @Authorized([Role.Practitioner, Role.Admin, Role.HealthCoach])
  @Query(() => [CalAvailability])
  getProviderAvailability(
    @Arg("email") email: string,
    @Arg("eaProviderId") eaProviderId: string
  ) {
    //   @Ctx() context: Context
    return this.calSchedulerService.getProviderAvailability(email, eaProviderId)
  }
}

import { Authorized, Ctx, Query, Resolver } from "type-graphql"

import Role from "../schema/enums/Role"
import Context from "../types/context"
import AlertService from "../services/altert.service"
import { Alert } from "../schema/alert.schema"

@Resolver()
export default class AlertResolver {
  private alertService: AlertService

  constructor() {
    this.alertService = new AlertService()
  }

  @Authorized([Role.Practitioner])
  @Query(() => [Alert])
  getAlerts(@Ctx() context: Context) {
    return this.alertService.getAlertByProvider(context.user)
  }
}

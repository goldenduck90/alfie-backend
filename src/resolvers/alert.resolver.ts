import { Authorized, Arg, Ctx, Query, Resolver, Mutation } from "type-graphql"

import Role from "../schema/enums/Role"
import Context from "../types/context"
import AlertService from "../services/altert.service"
import { Alert, AcknowledgeAlertInput } from "../schema/alert.schema"

@Resolver()
export default class AlertResolver {
  private alertService: AlertService

  constructor() {
    this.alertService = new AlertService()
  }

  @Authorized([Role.Practitioner])
  @Query(() => [Alert])
  getAlerts(@Ctx() context: Context) {
    return this.alertService.getAlertsByPatient(context.user)
  }

  @Authorized([Role.Practitioner])
  @Query(() => [Alert])
  getAlertsByPatient(
    @Ctx() context: Context,
    @Arg("patientId") patientId: string
  ) {
    return this.alertService.getAlertsByPatient(context.user, patientId)
  }

  @Authorized([Role.Practitioner])
  @Mutation(() => Alert)
  acknowledgeAlert(@Arg("input") input: AcknowledgeAlertInput) {
    return this.alertService.acknowledgeAlert(input.id)
  }
}

import {
  BulkPatientReassignInput,
  PatientModifyInput,
  PatientReassignInput,
  ProviderCreateInput,
  ProviderModifyInput,
} from "./../schema/internal.schema"
import { User } from "./../schema/user.schema"
import { Role } from "./../schema/enums/Role"
import InternalOperationsService from "../services/internal.service"
import { Authorized, Mutation, Arg } from "type-graphql"

export default class InternalResolver {
  private internalService = new InternalOperationsService()

  @Authorized([Role.Internal])
  @Mutation(() => User)
  internalPatientReassign(@Arg("input") input: PatientReassignInput) {
    return this.internalService.internalPatientReassign(input)
  }

  @Authorized([Role.Internal])
  @Mutation(() => Boolean)
  internalBulkPatientReassign(@Arg("input") input: BulkPatientReassignInput) {
    this.internalService.internalBulkPatientReassign(input)
    return true
  }

  @Authorized([Role.Internal])
  @Mutation(() => Boolean)
  internalPatientModify(@Arg("input") input: PatientModifyInput) {
    this.internalService.internalPatientModify(input)
    return true
  }

  @Authorized([Role.Internal])
  @Mutation(() => User)
  internalOpsModifyProvider(@Arg("input") input: ProviderModifyInput) {
    return this.internalService.internalOpsModifyProvider(input)
  }

  @Authorized([Role.Internal])
  @Mutation(() => User)
  internalOpsCreateNewProvider(@Arg("input") input: ProviderCreateInput) {
    return this.internalService.internalOpsCreateNewProvider(input)
  }
}

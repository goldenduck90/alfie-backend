import Context from "../types/context"
import { Arg, Authorized, Ctx, Mutation, Resolver } from "type-graphql"
import {
  File,
  SignedUrlRequest,
  SignedUrlResponse,
  User,
} from "../schema/user.schema"
import Role from "../schema/enums/Role"
import S3Service from "../services/s3.service"
import AkuteService from "../services/akute.service"
import { AkuteDocument, DocUploadInput } from "../schema/akute.schema"
import UserService from "../services/user.service"
import { InsuranceTextractResponse } from "../schema/upload.schema"

@Resolver()
export default class UploadResolver {
  private akuteService: AkuteService
  private s3Service: S3Service
  private userService: UserService

  constructor() {
    this.s3Service = new S3Service()
    this.akuteService = new AkuteService()
    this.userService = new UserService()
  }

  @Authorized([Role.Patient])
  @Mutation(() => [SignedUrlResponse])
  requestSignedUrls(
    @Arg("requests", () => [SignedUrlRequest]) requests: SignedUrlRequest[]
  ) {
    return this.s3Service.requestSignedUrls(requests)
  }

  @Authorized([Role.Patient])
  @Mutation(() => AkuteDocument)
  uploadDocument(@Arg("input") input: DocUploadInput) {
    return this.akuteService.uploadDocument(input)
  }

  @Authorized([Role.Patient])
  @Mutation(() => User)
  completeUpload(
    @Ctx() context: Context,
    @Arg("files", () => [File]) files: File[]
  ) {
    return this.userService.completeUpload(files, context.user._id)
  }

  @Authorized([Role.Admin, Role.Patient])
  @Mutation(() => InsuranceTextractResponse)
  async insuranceTextract(
    @Ctx() context: Context,
    @Arg("userId", { nullable: true }) userId: string,
    @Arg("s3Key") s3Key: string
  ) {
    const user = userId ? await this.userService.getUser(userId) : context.user
    const result = await this.userService.textractInsuranceImage(
      user._id.toString(),
      s3Key
    )
    return result
  }
}

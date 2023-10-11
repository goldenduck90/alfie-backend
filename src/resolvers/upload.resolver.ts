import Context from "../types/context"
import { Arg, Authorized, Ctx, Mutation, Resolver } from "type-graphql"
import {
  File,
  SignedUrlRequest,
  SignedUrlResponse,
  User,
} from "../schema/user.schema"
import Role from "../schema/enums/Role"
import { AkuteDocument, DocUploadInput } from "../schema/akute.schema"
import { InsuranceTextractResponse } from "../schema/upload.schema"
import S3Service from "../services/s3.service"
import AkuteService from "../services/akute.service"
import UserService from "../services/user.service"
import UploadService from "../services/upload.service"

@Resolver()
export default class UploadResolver {
  private akuteService: AkuteService
  private s3Service: S3Service
  private userService: UserService
  private uploadService: UploadService

  constructor() {
    this.s3Service = new S3Service()
    this.akuteService = new AkuteService()
    this.userService = new UserService()
    this.uploadService = new UploadService()
  }

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

  @Mutation(() => InsuranceTextractResponse)
  async insuranceTextract(
    @Arg("s3Key") s3Key: string
  ): Promise<InsuranceTextractResponse> {
    const result = await this.uploadService.textractInsuranceImage(s3Key)
    return result
  }
}

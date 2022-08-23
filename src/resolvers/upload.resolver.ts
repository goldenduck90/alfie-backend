import Context from "../types/context"
import { Arg, Authorized, Ctx, Mutation, Resolver } from "type-graphql"
import {
  File,
  Role,
  SignedUrlRequest,
  SignedUrlResponse,
  User,
} from "../schema/user.schema"
import S3Service from "../services/s3.service"

@Resolver()
export default class UploadResolver {
  constructor(private s3Service: S3Service) {
    this.s3Service = new S3Service()
  }

  @Authorized([Role.Patient])
  @Mutation(() => [SignedUrlResponse])
  requestSignedUrls(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    @Arg("requests", (_) => [SignedUrlRequest]) requests: SignedUrlRequest[]
  ) {
    return this.s3Service.requestSignedUrls(requests)
  }

  @Authorized([Role.Patient])
  @Mutation(() => User)
  completeUpload(
    @Ctx() context: Context,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    @Arg("files", (_) => [File]) files: File[]
  ) {
    return this.s3Service.completeUpload(files, context.user._id)
  }
}

import { FieldResolver, Resolver, Root } from "type-graphql"
import { File } from "../schema/user.schema"
import S3Service from "../services/s3.service"

@Resolver(() => File)
export default class FileResolver {
  private s3Service: S3Service

  constructor() {
    this.s3Service = new S3Service()
  }

  @FieldResolver(() => String)
  async signedUrl(@Root() file: File): Promise<string> {
    const url = await this.s3Service.getSignedUrl(
      {
        key: file.key,
        versionId: file.versionId,
        contentType: file.contentType,
      },
      "get"
    )

    return url
  }
}

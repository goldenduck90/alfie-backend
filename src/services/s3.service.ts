import { S3 } from "aws-sdk"
import config from "config"
import { SignedUrlRequest, SignedUrlResponse } from "../schema/user.schema"

export default class S3Service {
  private s3: S3
  public bucketName: string
  expiresInSeconds: string

  constructor(bucketName?: string) {
    this.bucketName = bucketName ?? config.get("s3.patientBucketName")
    this.expiresInSeconds = config.get("s3.expiresInSeconds")

    this.s3 = new S3({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION,
    })
  }

  async keyExists(objectKey: string) {
    try {
      await this.s3
        .headObject({
          Bucket: this.bucketName,
          Key: objectKey,
        })
        .promise()

      return true
    } catch (error) {
      if (error.code === "NotFound") {
        return false
      }

      throw error
    }
  }

  async requestSignedUrls(
    input: SignedUrlRequest[]
  ): Promise<SignedUrlResponse[]> {
    const urls = await Promise.all(
      input.map(async (item) => {
        const url = await this.getSignedUrl(
          {
            key: item.key,
            ...(item.metadata && {
              metadata: item.metadata.reduce(
                (
                  accumulator: S3.Metadata,
                  meta: { key: string; value: string }
                ) => {
                  return {
                    ...accumulator,
                    [meta.key]: meta.value,
                  }
                },
                {}
              ),
            }),
            contentType: item.contentType,
            versionId: item.versionId,
          },
          item.requestType as "put" | "get"
        )
        return { key: item.key, url }
      })
    )

    return urls
  }

  async getSignedUrl(
    {
      key,
      metadata,
      contentType,
      versionId,
    }: {
      key: string
      metadata?: S3.Metadata
      contentType: string
      versionId?: string
    },
    requestType: "put" | "get" = "put"
  ): Promise<string> {
    if (requestType === "get") {
      const params: S3.GetObjectRequest = {
        Bucket: this.bucketName,
        Key: key,
        VersionId: versionId,
        ResponseContentType: contentType,
      }
      return await this.s3.getSignedUrlPromise("getObject", params)
    } else {
      const params: S3.PutObjectRequest = {
        Bucket: this.bucketName,
        Key: key,
        Metadata: metadata,
        Expires: Number(this.expiresInSeconds) as any,
        ContentType: contentType,
      }
      return await this.s3.getSignedUrlPromise("putObject", params)
    }
  }
}

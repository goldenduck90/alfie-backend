import { ApolloError } from "apollo-server"
import { S3 } from "aws-sdk"
import config from "config"
import {
  File,
  SignedUrlRequest,
  SignedUrlResponse,
  User,
  UserModel,
} from "../schema/user.schema"

class S3Service {
  private s3: S3
  bucketName: string
  expiresInSeconds: string

  constructor() {
    this.bucketName = config.get("s3.patientBucketName")
    this.expiresInSeconds = config.get("s3.expiresInSeconds")

    this.s3 = new S3({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION,
    })
  }

  async completeUpload(input: File[], userId: string): Promise<User> {
    const { notFound } = config.get("errors.user") as any
    const user = await UserModel.findById(userId).countDocuments()
    if (!user) {
      throw new ApolloError(notFound.message, notFound.code)
    }
    const update = await UserModel.findOneAndUpdate(
      {
        _id: userId,
      },
      {
        $push: {
          files: { $each: input },
        },
      }
    )

    return update
  }

  async requestSignedUrls(
    input: SignedUrlRequest[]
  ): Promise<SignedUrlResponse[]> {
    const urls = await Promise.all(
      input.map(async (item) => {
        const url = await this.getSignedUrl({
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
        })
        return { key: item.key, url }
      })
    )

    return urls
  }

  async getSignedUrl({
    key,
    metadata,
    contentType,
  }: {
    key: string
    metadata?: S3.Metadata
    contentType: string
  }): Promise<string> {
    const params: S3.PutObjectRequest = {
      Bucket: this.bucketName,
      Key: key,
      Metadata: metadata,
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore: AWS types are wrong
      Expires: Number(this.expiresInSeconds),
      ContentType: contentType,
    }

    const url = await this.s3.getSignedUrlPromise("putObject", params)
    return url
  }
}

export default S3Service

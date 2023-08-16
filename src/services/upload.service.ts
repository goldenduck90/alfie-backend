import { ApolloError } from "apollo-server-errors"
import { InsuranceTextractResponse } from "../schema/upload.schema"
import extractInsurance from "../utils/extractInsurance"
import { analyzeS3InsuranceCardImage } from "../utils/textract"
import S3Service from "./s3.service"
import config from "config"

export default class UploadService {
  private checkoutS3Service: S3Service

  constructor() {
    const bucket: string = config.get("s3.checkoutBucketName")
    this.checkoutS3Service = new S3Service(bucket)
  }

  async textractInsuranceImage(
    fileS3Key: string,
    userState?: string
  ): Promise<InsuranceTextractResponse> {
    const exists = await this.checkoutS3Service.keyExists(fileS3Key)
    if (!exists) {
      throw new ApolloError("Insurance file does not exist.", "NOT_FOUND")
    }

    const result = await analyzeS3InsuranceCardImage(
      this.checkoutS3Service.bucketName,
      fileS3Key
    )

    const extracted = extractInsurance(result, { userState })

    const insuranceMatches = extracted.map(({ insurance }) => insurance)
    const { words, lines } = result

    return {
      insuranceMatches,
      words,
      lines,
    }
  }
}

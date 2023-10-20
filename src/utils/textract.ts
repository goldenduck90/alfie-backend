import { ApolloError } from "apollo-server-errors"
import Textract from "aws-sdk/clients/textract"
import { captureException } from "./sentry"
import { InsuranceType } from "../schema/insurance.schema"

export interface AnalyzeS3InsuranceCardImageResult {
  insurance: {
    insurance_type: InsuranceType
    group_number: string
    member_id: string
  }
  words: string[]
  lines: string[]
}

/**
 * Uses AWS Textract API to extract data from an insurance card stored in S3.
 */
export const analyzeS3InsuranceCardImage = async (
  bucket: string,
  objectName: string
): Promise<AnalyzeS3InsuranceCardImageResult> => {
  const result = await textractS3Object(bucket, objectName, [
    { question: "What is the Group Number?", key: "group_number" },
    {
      question: `Select the insurance plan type from the following options: ${Object.values(
        InsuranceType
      ).join(", ")}`,
      key: "insurance_type",
    },
    { question: "What is the Member ID?", key: "member_id" },
  ])

  return {
    insurance: result.queries as any,
    words: result.words,
    lines: result.lines,
  }
}

export interface TextractS3ObjectResult {
  /** Results to queries in `queries` parameter. */
  queries: Record<string, string>
  /** Words found on the image. */
  words: string[]
  /** Lines of text found on the image. */
  lines: string[]
}

/**
 * Uses AWS Textract API to extract data from an insurance card stored in S3.
 */
export const textractS3Object = async (
  bucket: string,
  objectName: string,
  /** A collection of queries against the textract API. */
  queries: {
    /** The Text field of a query. */
    question: string
    /** The Alias field of a query. */
    key: string
  }[]
): Promise<TextractS3ObjectResult> => {
  const textract = new Textract({
    region: "us-east-1",
  })

  console.log(bucket, objectName)

  try {
    const data = await new Promise<TextractS3ObjectResult>(
      (resolve, reject) => {
        textract.analyzeDocument(
          {
            Document: {
              S3Object: {
                Bucket: bucket,
                Name: objectName,
              },
            },
            FeatureTypes: ["QUERIES"],
            QueriesConfig: {
              Queries: queries.map((query) => ({
                Text: query.question,
                Alias: query.key,
              })),
            },
          },
          (err, res) => {
            if (err) {
              return reject(err)
            }

            const idToText: Record<string, string> = {}
            const idToAlias: Record<string, string> = {}
            const words: string[] = []
            const lines: string[] = []

            res.Blocks.forEach((block) => {
              if (block.BlockType === "QUERY_RESULT") {
                idToText[block.Id] = block.Text
              } else if (block.BlockType === "QUERY") {
                block.Relationships?.forEach((relationship) => {
                  if (relationship.Type === "ANSWER") {
                    relationship?.Ids.forEach((answerId) => {
                      idToAlias[answerId] = block.Query.Alias
                    })
                  }
                })
              } else if (block.BlockType === "WORD") {
                words.push(block.Text)
              } else if (block.BlockType === "LINE") {
                lines.push(block.Text)
              }
            })

            const result: Record<string, string> = {}
            Object.keys(idToAlias).forEach((key) => {
              result[idToAlias[key]] = idToText[key]
            })

            resolve({
              queries: result as any,
              words,
              lines,
            })
          }
        )
      }
    )

    return data
  } catch (error) {
    console.log(error)

    captureException(error, "textractS3Object", {
      bucket,
      objectName,
      queries,
    })
    throw new ApolloError("Error extracting text.", "TEXT_EXTRACT_ERROR")
  }
}

import * as Sentry from "@sentry/node"
import Textract from "aws-sdk/clients/textract"

export interface AnalyzeS3InsuranceCardImageResult {
  group_number: string
  group_name: string
  plan_name: string
  plan_type: string
  insurance_type: string
  member_id: string
  payer_id: string
  payer_name: string
  rx_bin: string
  rx_pcn: string
}

/**
 * Uses AWS Textract API to extract data from an insurance card stored in S3.
 */
export const analyzeS3InsuranceCardImage = async (
  bucket: string,
  objectName: string
): Promise<AnalyzeS3InsuranceCardImageResult> => {
  const textract = new Textract({
    region: "us-east-1",
  })

  try {
    const data = await new Promise<AnalyzeS3InsuranceCardImageResult>(
      (resolve, reject) => {
        textract.analyzeDocument(
          {
            Document: {
              S3Object: {
                Bucket: "",
                Name: "",
              },
            },
            FeatureTypes: ["QUERIES"],
            QueriesConfig: {
              Queries: [
                { Text: "What is the Group Number?", Alias: "group_number" },
                { Text: "What is the Group Name?", Alias: "group_name" },
                { Text: "What is the Plan Name?", Alias: "plan_name" },
                { Text: "What is the Plan Type?", Alias: "plan_type" },
                {
                  Text: "What is the Insurance Type?",
                  Alias: "insurance_type",
                },
                { Text: "What is the Member ID?", Alias: "member_id" },
                { Text: "What is the Payer ID?", Alias: "payer_id" },
                { Text: "What is the Payer Name?", Alias: "payer_name" },
                { Text: "What is the Rx Bin?", Alias: "rx_bin" },
                { Text: "What is the Rx PCN?", Alias: "rx_pcn" },
              ],
            },
          },
          (err, res) => {
            if (err) {
              reject(err)
            }

            const idToText: Record<string, string> = {}
            const idToAlias: Record<string, string> = {}

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
              }
            })

            const result: Record<string, string> = {}
            Object.keys(idToAlias).forEach((key) => {
              result[idToAlias[key]] = idToText[key]
            })

            resolve(result as any)
          }
        )
      }
    )

    return data
  } catch (err) {
    Sentry.captureException(err)
    console.log(
      `Error running AWS textract on image at ${bucket}, ${objectName}`,
      err
    )
    return null
  }
}

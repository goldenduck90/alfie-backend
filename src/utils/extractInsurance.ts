import { AnalyzeS3InsuranceCardImageResult } from "./textract"
import { InsuranceTextractDetails } from "../schema/upload.schema"

/**
 * Extracts information from a textract result
 */
export default function extractInsurance(
  extracted: AnalyzeS3InsuranceCardImageResult
): InsuranceTextractDetails {
  return {
    company: extracted.insurance.insurance_company,
    type: extracted.insurance.insurance_type,
    memberId: extracted.insurance.member_id,
    groupId: extracted.insurance.group_number,
  }
}

import { Insurance } from "../schema/user.schema"
import { AnalyzeS3InsuranceCardImageResult } from "./textract"
import lookupCPID from "./lookupCPID"
import { sorted, uniqueItems } from "./collections"
import resolveCPIDEntriesToInsurance from "./resolveCPIDEntriesToInsurance"
import lookupState from "./lookupState"

/**
 * Extracts information from a textract result into a given number
 * of possible insurance/CPID combinations to try.
 */
export default function extractInsurance(
  extracted: AnalyzeS3InsuranceCardImageResult,
  options?: {
    userState?: string
  }
): { insurance: Insurance; cpid: string }[] {
  options = options ?? {}

  // start with the insurance data parsed from the image
  const insurance: Insurance = {
    payor: extracted.insurance.payer_id,
    insuranceCompany: extracted.insurance.payer_name,
    memberId: extracted.insurance.member_id,
    groupId: extracted.insurance.group_number,
    groupName: extracted.insurance.group_name,
    rxBIN: extracted.insurance.rx_bin,
    rxPCN: extracted.insurance.rx_pcn,
    rxGroup: extracted.insurance.rx_group,
  }

  // get matches from the lookup CPID function.
  const directMatches = lookupCPID(
    extracted.insurance.payer_id,
    extracted.insurance.payer_name,
    12
  )

  // get matches with the extracted state, without passing
  // any specific payer ID.
  let extractedStates = [options.userState, extracted.insurance.state]
    .map((state) => lookupState(state))
    .filter((state) => state)

  extractedStates = uniqueItems(extractedStates, (s) => s)

  let extractedStateMatches = extractedStates
    .map((state) =>
      lookupCPID(null, `${extracted.insurance.payer_name} ${state}`, 4)
    )
    .flatMap((x) => x)

  extractedStateMatches = uniqueItems(
    extractedStateMatches,
    (m) => m.primary_name
  )

  // get matches using random payorId-like words in the extracted text
  const payorIdMatchPattern =
    /^([0-9]{3,9})|([A-Z0-9]{5,10})|([A-Z0-9]{2,8}-[A-Z0-9]{3,7})$/
  const matchingExtractedWords = extracted.words
    .filter((word) => payorIdMatchPattern.test(word))
    // split words by non-alphanumeric characters, and include
    // in addition to the original word
    .map((word) => [
      word,
      ...word.split(/[^a-zA-Z0-9]/).filter((w) => payorIdMatchPattern.test(w)),
    ])
    .flatMap((x) => x)

  const payorIdWordMatches = uniqueItems(matchingExtractedWords, (w) => w)
    .map((word) => lookupCPID(word, null, 3))
    .flatMap((x) => x)

  const allMatches = [
    ...directMatches,
    ...extractedStateMatches,
    ...payorIdWordMatches,
  ]

  // sort all matches by score
  const sortedMatches = sorted(
    allMatches,
    (item) => item.matchScore,
    "descending"
  )

  const uniqueMatches = uniqueItems(sortedMatches, (item) => item.primary_name)

  // transform into an array of { insurance, cpid }
  const insuranceResults = resolveCPIDEntriesToInsurance(
    uniqueMatches,
    insurance
  )

  return insuranceResults
}

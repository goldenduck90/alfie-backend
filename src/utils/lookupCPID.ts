import cpids from "./cpids.json"
import stringSimilarity from "string-similarity-js"

/** Looks up a CPID given a payer ID and optional primary name (payer name). Returns null if no matches were found. */
const lookupCPID = (payerId: string, primaryName: string): string | null => {
  const payerIdMatches = cpids.filter(({ payer_id }) => payer_id == payerId)

  if (payerIdMatches.length === 0) {
    return null
  }

  const similarities = payerIdMatches.map(({ primary_name }) =>
    stringSimilarity(primary_name, primaryName)
  )
  const highestIndex = similarities.reduce(
    (highest, similarity, index) =>
      similarity > similarities[highest] ? index : highest,
    0
  )

  return payerIdMatches[highestIndex].cpid
}

export default lookupCPID

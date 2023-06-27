import cpids from "./cpids.json"
import stringSimilarity from "string-similarity-js"

export type CPIDEntry = typeof cpids[number]
export type ScoredCPIDEntry = CPIDEntry & { matchScore: number }

/** Looks up a CPID given a payer ID and optional primary name (payer name). Returns null if no matches were found. */
export default function lookupCPID(
  payerId: string | null,
  primaryName: string,
  maxMatches = 12
): CPIDEntry[] {
  const payerIdMatches = cpids.filter(({ payer_id }) => payer_id == payerId)

  if (payerIdMatches.length === 1) {
    return [payerIdMatches[0]]
  }

  // if there is no payer ID, or there were no matches to the payer ID column, use the entire table,
  // otherwise use only entries that matched the input payerId.
  const lookupTable =
    !payerId || payerIdMatches.length === 0 ? cpids : payerIdMatches

  const sortedMatches = sortAndScoreEntries(lookupTable, primaryName)
  return sortedMatches
    .slice(0, maxMatches)
    .map(({ cpid, primary_name, payer_id }) => ({
      cpid,
      primary_name,
      payer_id,
    }))
}

/**
 * Returns the CPIDs table with an additional field: `matchScore`, used
 * to sort by match strength on the primary_name field.
 */
function sortAndScoreEntries(
  table: CPIDEntry[],
  search: string
): ScoredCPIDEntry[] {
  const searchTerms = search.toLowerCase().split(/\s+/)
  const sortedMatches = table
    // search term matches
    .map((entry) => {
      const nameTerms = entry.primary_name.toLowerCase().split(/\s+/)
      const matchedNameTerms = nameTerms.filter(
        (nameTerm) => !searchTerms.some((searchTerm) => searchTerm === nameTerm)
      ).length
      const unmatchedNameTerms = nameTerms.length - matchedNameTerms
      const matchedSearchTerms = searchTerms.filter((term) =>
        entry.primary_name.toLowerCase().includes(term)
      ).length
      const unmatchedSearchTerms = searchTerms.length - matchedSearchTerms
      const similarity = stringSimilarity(entry.primary_name, search)
      return {
        ...entry,
        // (the number of matches (both ways) - the number of unmatched terms (both ways)) weighted by the similarity result
        matchScore:
          (matchedNameTerms +
            matchedSearchTerms -
            unmatchedSearchTerms -
            unmatchedNameTerms) *
          similarity,
      }
    })
    // sort by score
    .sort((a, b) => b.matchScore - a.matchScore)

  return sortedMatches
}

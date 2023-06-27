import cpids from "./cpids.json"
import stringSimilarity from "string-similarity-js"

/** Looks up a CPID given a payer ID and optional primary name (payer name). Returns null if no matches were found. */
const lookupCPID = (payerId: string | null, primaryName: string, maxMatches: number = 12): string[] => {
  const payerIdMatches = cpids.filter(({ payer_id }) => payer_id == payerId)

  if (payerIdMatches.length === 1) {
    return [payerIdMatches[0].cpid]
  }

  if (!payerId || payerIdMatches.length === 0) {
    // lookup from payor name
    const sortedMatches = sortAndScoreEntries(primaryName)
    return sortedMatches.slice(0, maxMatches).map(({ cpid }) => cpid)
  }

  const similarities = payerIdMatches.map(({ primary_name }) =>
    stringSimilarity(primary_name, primaryName)
  )
  const highestIndex = similarities.reduce(
    (highest, similarity, index) =>
      similarity > similarities[highest] ? index : highest,
    0
  )

  return payerIdMatches
}

/**
 * Returns the CPIDs table with an additional field: `matchScore`, used
 * to sort by match strength on the primary_name field.
 */
function sortAndScoreEntries(search: string) {
  const searchTerms = search.toLowerCase().split(/\s+/)
  const sortedMatches = cpids
    // search term matches
    .map(entry => {
      const nameTerms = entry.primary_name.toLowerCase().split(/\s+/)
      const matchedNameTerms = nameTerms
        .filter((nameTerm) => !searchTerms.some((searchTerm) => searchTerm === nameTerm))
        .length
      const unmatchedNameTerms = nameTerms.length - matchedNameTerms
      const matchedSearchTerms = searchTerms
        .filter((term) => entry.primary_name.toLowerCase().includes(term)).length
      const unmatchedSearchTerms = searchTerms.length - matchedSearchTerms
      const similarity = stringSimilarity(entry.primary_name, search)
      return {
        ...entry,
        // (the number of matches (both ways) - the number of unmatched terms (both ways)) weighted by the similarity result
        matchScore: (matchedNameTerms + matchedSearchTerms - unmatchedSearchTerms - unmatchedNameTerms) * similarity,
      }
    })
    // sort by score
    .sort((a, b) => b.matchScore - a.matchScore)

  return sortedMatches
}

export default lookupCPID

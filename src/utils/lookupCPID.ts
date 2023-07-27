import { sorted, uniqueItems } from "./collections"
import cpids from "./cpids.json"
import stringSimilarity from "string-similarity-js"

export type CPIDEntry = typeof cpids[number]
export type ScoredCPIDEntry = CPIDEntry & { matchScore: number }

/** If the match is partially from an exact payer ID match, add 3 to the match score. */
const payerIdMatchScoreModifier = 8

/**
 * Looks up a CPID given a payer ID and optional primary name (payer name). Returns null if no matches were found.
 * If the results score highly, incorporates state code into the search terms.
 */
export default function lookupCPID(
  payerId: string | null,
  primaryName: string | null,
  maxMatches = 10
): ScoredCPIDEntry[] {
  primaryName = primaryName ?? ""

  const unpadZeros = (str: string) => str.replace(/^0+/, "")
  const unpaddedPayor = unpadZeros(payerId ?? "")
  const payerIdMatches = cpids.filter(
    ({ payer_id }) => unpadZeros(payer_id) === unpaddedPayor
  )

  if (!primaryName) {
    return payerIdMatches.map((entry) => ({
      ...entry,
      matchScore: payerIdMatchScoreModifier,
    }))
  }

  // if there is no payer ID, or there were no matches to the payer ID column, use the entire table,
  // otherwise use only entries that matched the input payerId.
  const lookupTable =
    !payerId || payerIdMatches.length === 0 ? cpids : payerIdMatches
  const scoreModifier =
    payerIdMatches.length > 0 ? payerIdMatchScoreModifier : 0

  const sortedMatches = scoreAndSortEntries(
    lookupTable,
    // insurance company name
    primaryName
  ).map((item) => ({ ...item, matchScore: item.matchScore + scoreModifier }))

  const uniqueMatches = uniqueItems(sortedMatches, (item) => item.primary_name)

  return uniqueMatches.slice(0, maxMatches)
}

export const extractTerms = (searchString: string): string[] =>
  searchString
    // replace camel-case with multiple words (OneTwo -> One Two)
    .replace(/([A-Z][a-z]+)([A-Z][a-z]+)([A-Z][a-z]+)?/g, "$1 $2 $3")
    .trim()
    // lowercase comparison
    .toLowerCase()
    // split by whitespace
    .split(/\s+/)
    // remove non-alphanumeric characters from each word in the payer name
    .map((str) => str.replace(/[^0-9a-zA-Z]/g, ""))
    // remove empty terms
    .filter((str) => str)

/**
 * Returns the CPIDs table with an additional field: `matchScore`, used
 * to sort by match strength against the primary_name field.
 */
function scoreAndSortEntries(
  table: CPIDEntry[],
  search: string
): ScoredCPIDEntry[] {
  const searchTerms = extractTerms(search)

  const lookupResult = table
    // search term matches
    .map((entry) => {
      const nameTerms = extractTerms(entry.primary_name)

      // number of words that are in both primary_name and search terms
      const commonTerms = countMatchingItems(searchTerms, nameTerms)
      // search terms not in name terms
      const unmatchedSearchTerms = countMissingItems(nameTerms, searchTerms)
      // similarity index of 2-grams (0 to 1)
      const similarity = stringSimilarity(entry.primary_name, search)

      // compile into a sortable score
      // common terms * fraction of search terms * fraction of name terms * similarity index
      const matchScore =
        (2 * commonTerms - unmatchedSearchTerms) * 2 * similarity

      return {
        ...entry,
        matchScore,
      }
    })

  return sorted(lookupResult, (item) => item.matchScore, "descending")
}

/**
 * Returns the number of terms that appear in both sets of terms.
 */
const countMatchingItems = (set1: string[], set2: string[]) =>
  set1.filter((searchTerm) => set2.includes(searchTerm)).length

/**
 * Count items from `set` that are missing from `searchTerms`.
 */
const countMissingItems = (set: string[], searchTerms: string[]) =>
  set.filter((item) => !searchTerms.includes(item)).length

import cpids from "./cpids.json"

/** Looks up a CPID given a payer ID and optional primary name (payer name). Returns null if no matches were found. */
const lookupCPID = (payerId: string, primaryName: string): string | null => {
  const bothMatch = cpids.find(
    ({ payer_id, primary_name }) =>
      payer_id === payerId &&
      primary_name.toLowerCase() === primaryName.toLowerCase()
  )
  const payerIdMatches = cpids.find(({ payer_id }) => payer_id === payerId)
  return bothMatch?.cpid ?? payerIdMatches?.cpid ?? null
}

export default lookupCPID

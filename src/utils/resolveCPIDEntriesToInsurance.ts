import { Insurance } from "../schema/user.schema"
import { ScoredCPIDEntry } from "./lookupCPID"

/**
 * Resolves CPID entries from lookupCPID with
 * a base Insurance object, returning a list of
 * <insurance, cpid> tuples.
 */
export default function resolveCPIDEntriesToInsurance(
  entries: ScoredCPIDEntry[],
  insurance: Insurance
) {
  return entries.map((entry) => ({
    insurance: {
      ...insurance,
      payor: entry.payer_id,
      insuranceCompany: entry.primary_name,
    },
    cpid: entry.cpid,
  }))
}

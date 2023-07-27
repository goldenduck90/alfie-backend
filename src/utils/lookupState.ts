import states from "./states.json"

export type StateEntry = typeof states[number]

export default function lookupState(stateString: string): string | null {
  if (!stateString) {
    return null
  }

  const search = stateString
    .toLowerCase()
    // remove non-alpha/whitespace
    .replace(/[^a-z ]/g, "")

  const state = states.find((entry) =>
    [entry.code, entry.name].map((s) => s.toLowerCase()).includes(search)
  )

  return state?.name ?? null
}

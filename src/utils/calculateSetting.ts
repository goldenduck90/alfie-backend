/**
 * One condition within a setting. E.g. `{ var1: [3, 5], var2: "hello world" }` would pass
 * if var1 was between 3 and 5, and if var2 was equal to "hello world". Functions as AND operator
 * as all of these conditions must pass.
 */
export type SettingCondition = Record<
  string,
  any | any[] | ((value: any) => boolean)
>

/** Variables to resolve to if the conditions are met. */
export type ResolvedSetting<T = any> = Record<string, T>

/** A setting definition for value(s). */
export interface SettingDefinition {
  /**
   * Conditions, at least one of which must be met (functions as OR operator).
   * If the value is a primitive, the comparison used is ===.
   * If the value is an array, it is a range of acceptable values in [min, max] format (inclusive).
   */
  conditions: SettingCondition[]

  /** Variables to resolve to if the conditions are met, indexed by var name. */
  vars: ResolvedSetting
}

/**
 * A list of settings definitions.
 *
 * @example
 * ```javascript
 * [{
 *   vars: { diagnosis: "E66.9" },
 *   criteria: [
 *     { bmi: [30, Infinity] }
 *   ]
 * }]
 * ```
 */
export type SettingsList = SettingDefinition[]

/** Calculate a setting, returning vars from the first matching criteria. */
export const calculateSetting = <T = ResolvedSetting>(
  /** A list of settings with conditions and resulting variable values. */
  settings: SettingsList,
  /** Vars to retrieve from the settings list (names of the keys in the settings list `vars` fields). */
  vars: string[],
  /** Values to use when evaluating conditions. */
  values: ResolvedSetting
): T => {
  const result: Record<string, any[]> = calculateSettings(
    settings,
    vars,
    values
  )

  // take the first item from each key of `result`
  const initialResult: Record<string, any[]> = {}
  for (const key in result) {
    initialResult[key] = result[key][0] ?? null
  }

  return initialResult as unknown as T
}

/**
 * Resolves the requested vars to their values from the settings list.
 * Each variable in `vars` is resolved separately, so the lengths for each key
 * in the result corresponding to the resolved variables from `vars` may not be equal.
 * Whereas `calculateSetting` only returns the first resolved variable that matches
 * the conditions, for each var in `vars`, `calculateSettings` returns all resolved
 * variables that match the conditions.
 */
export const calculateSettings = <T = ResolvedSetting<any[]>>(
  /** A list of settings with conditions and resulting variable values. */
  settings: SettingsList,
  /** Vars to retrieve from the settings list (names of the keys in the settings list `vars` fields). */
  vars: string[],
  /** Values to use when evaluating conditions. */
  values: ResolvedSetting
): T => {
  const result: Record<string, any> = {}

  // resolve each variable if possible
  for (const variable of vars) {
    const relevantSettings = settings.filter(
      (setting) => setting.vars[variable] !== undefined
    )
    const passedSettings = relevantSettings.filter((setting) => {
      const { conditions } = setting
      return (
        !conditions ||
        conditions.length === 0 ||
        passesConditions(conditions, values).length > 0
      )
    })

    result[variable] = []

    // for each matched setting in the settings list,
    // append the resolved variable value to the result.
    // when a var in `vars` does not have a setting
    // that passes all of the conditions, `result[variable]` remains
    // an empty array.
    passedSettings.forEach(({ vars: resolvedVars }) => {
      result[variable].push(resolvedVars[variable])
    })
  }

  return result as T
}

/**
 * Returns a filtered result of the conditions that passed given the values parameter.
 * If a condition requires values not included in the `values` map, the condition does not pass.
 */
export const passesConditions = (
  conditions: SettingCondition[],
  values: ResolvedSetting
): SettingCondition[] => {
  return conditions.filter((condition) => {
    return Object.keys(condition).every((valueKey) => {
      // if the values passed to calculateSetting do not include the key
      // needed to check if this condition passes, skip this condition.
      if (!Object.keys(values).includes(valueKey)) return false

      const value = values[valueKey]

      const targetValue = condition[valueKey]
      if (typeof targetValue === "object" && targetValue.range !== undefined) {
        const range = (targetValue.range as (number | null)[]).map((num) =>
          num === null ? Infinity : num
        )
        return value >= range[0] && value <= range[1]
      } else if (Array.isArray(targetValue)) {
        return targetValue.includes(value)
      } else if (typeof targetValue === "function") {
        return targetValue(value)
      } else {
        return value === targetValue
      }
    })
  })
}

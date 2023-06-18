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
export type SettingsVariables = Record<string, any>

/** A setting definition for value(s). */
export interface SettingDefinition {
  /**
   * Conditions, at least one of which must be met (functions as OR operator).
   * If the value is a primitive, the comparison used is ===.
   * If the value is an array, it is a range of acceptable values in [min, max] format (inclusive).
   */
  conditions: SettingCondition[]

  /** Variables to resolve to if the conditions are met, indexed by var name. */
  vars: SettingsVariables
}

/** A list of settings definitions. */
export type SettingsList = SettingDefinition[]

/**
 * Resolves the requested vars to their values from the settings list.
 */
export default function calculateSetting<T = SettingsVariables>(
  /** A list of settings with conditions and resulting variable values. */
  settings: SettingsList,
  /** Vars to retrieve from the settings list (names of the keys in the settings list `vars` fields). */
  vars: string[],
  /** Values to use when evaluating conditions. */
  values: SettingsVariables
): Partial<T> {
  const result: Record<string, any> = {}

  // [{
  //   vars: { diagnosis: "E66.9" },
  //   criteria: [
  //     { bmi: [30, Infinity] }
  //   ]
  // }]

  /**
   * Returns a filtered result of the conditions that passed given the values parameter.
   * If a condition requires values not included in the `values` map, the condition does not pass.
   */
  const passingConditions = (
    conditions: SettingCondition[]
  ): SettingCondition[] => {
    return conditions.filter((condition) => {
      return Object.keys(condition).every((valueKey) => {
        // if the values passed to calculateSetting do not include the key
        // needed to check if this condition passes, skip this condition.
        if (!Object.keys(values).includes(valueKey)) return false

        const value = values[valueKey]

        const targetValue = condition[valueKey]
        if (
          typeof targetValue === "object" &&
          targetValue.range !== undefined
        ) {
          return value >= targetValue.range[0] && value <= targetValue.range[1]
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
        passingConditions(conditions).length > 0
      )
    })

    // if any settings resolved, use the first resolved setting to get the variable's value.
    if (passedSettings.length > 0) {
      const { vars: resolvedVars } = passedSettings[0]
      result[variable] = resolvedVars[variable]
    }
  }

  return result as T
}

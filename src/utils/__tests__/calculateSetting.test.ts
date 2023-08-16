import {
  SettingsList,
  calculateSetting,
  calculateSettings,
} from "../calculateSetting"

describe("calculateSetting util", () => {
  describe("calculateSetting (resolves to first matching var)", () => {
    it("should retrieve the first var where the values match the conditions", () => {
      const result = calculateSetting(
        [
          {
            vars: { example: 100, example2: 200 },
            conditions: [{ param1: 6, param2: 7 }],
          },
          {
            vars: { example: 10, example2: 50 },
            conditions: [{ param1: 5, param2: 12 }],
          },
        ],
        ["example", "example3"],
        { param1: 5, param2: 12 }
      )

      expect(result).toBeDefined()
      // in vars list with passing conditions.
      expect(result["example"]).toBe(10)
      // not in the vars list.
      expect(result["example2"]).not.toBeDefined()
      // in the vars list, but not resolved to any setting var.
      expect(result["example3"]).toBeNull()
    })

    it("should match multi-conditions, conditions with ranges, function conditions, array conditions", () => {
      const settings: SettingsList = [
        {
          vars: { example1: 10 },
          conditions: [
            { param1: [2, 4, 5], param2: { range: [8, 25] } },
            { param1: (v: number) => v % 10 === 3 },
          ],
        },
      ]

      const result = calculateSetting(settings, ["example1"], { param1: 3 })
      // the function condition for param1 should return true
      expect(result.example1).toBe(10)

      const result2 = calculateSetting(settings, ["example1"], {
        param1: 5,
        param2: 25,
      })
      // both of the fields in the first condition should pass
      expect(result2.example1).toBe(10)
    })
  })

  describe("calculateSettings (resolves multiple matching var values)", () => {
    it("should return multiple matching var values as an array, indexed by variable name", () => {
      const settings: SettingsList = [
        {
          vars: { example1: 30, example2: 40 },
          conditions: [{ param1: 3 }],
        },
        {
          vars: { example1: 40, example2: 50 },
          conditions: [{ param2: 4 }],
        },
        {
          vars: { example1: 70, example2: 80 },
          conditions: [{ param2: 5 }],
        },
        {
          vars: { example1: 100, example2: 110 },
          conditions: [{ param2: { range: [3, 5] } }],
        },
      ]

      // typed examples
      const result = calculateSettings<{
        example1: number[]
        example2: number[]
      }>(settings, ["example1", "example2"], { param1: 3, param2: 4 })

      expect(result.example1).toBeDefined()
      expect(result.example1).toHaveLength(3)
      expect(result.example1).toEqual([30, 40, 100])
      expect(result.example2).toEqual([40, 50, 110])
    })
  })
})

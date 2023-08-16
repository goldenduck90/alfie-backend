import * as statistics from "../statistics"

describe("statistics", () => {
  test("range", () => {
    expect(statistics.range(0, 4, 2)).toEqual([0, 2])
    expect(statistics.range(0, 1, 1)).toEqual([0])
    expect(statistics.range(0, 6, 3)).toEqual([0, 3])
    expect(statistics.range(10, 14, 3)).toEqual([10, 13])
  })

  test("ordinal", () => {
    expect(statistics.ordinal(10)).toBe("10th")
    expect(statistics.ordinal(22)).toBe("22nd")
    expect(statistics.ordinal(33)).toBe("33rd")
    expect(statistics.ordinal(44)).toBe("44th")
    expect(statistics.ordinal(35)).toBe("35th")
    expect(statistics.ordinal(86)).toBe("86th")
    expect(statistics.ordinal(97)).toBe("97th")
    expect(statistics.ordinal(38.333)).toBe("38th")
    expect(statistics.ordinal(19.1)).toBe("19th")
    expect(statistics.ordinal(-19.1)).toBe("-19th")
    expect(statistics.ordinal(null)).toBe(null)
  })
})

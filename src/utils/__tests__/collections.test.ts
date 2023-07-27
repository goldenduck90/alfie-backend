import { deepEquals } from "../collections"

describe("collections", () => {
  test("deepEquals", () => {
    expect(
      deepEquals(
        { a: 3, b: { c: 4, d: 5 }, e: [], f: [{ a: 2 }] },
        { b: { c: 4, d: 5 }, e: [], f: [{ a: 2 }], a: 3 }
      )
    ).toBe(true)

    expect(deepEquals(5, 5)).toBe(true)
    expect(deepEquals(true, true)).toBe(true)
    expect(deepEquals([1, 2, 3, 4], [1, 2, 3, 4])).toBe(true)
    expect(deepEquals([1, 2, 3, 4], [4, 3, 2, 1])).toBe(false)
    expect(deepEquals({ a: [1, 2, 3], b: 8 }, { a: [1, 2], b: 8 })).toBe(false)

    class Test {
      circular: Test
      constructor(public a: number) {
        this.a = a
        this.circular = this
      }
    }
    const anA = new Test(5)

    // circular references return false
    expect(deepEquals(anA, anA)).toBe(false)
  })
})

import { prepareContextObject } from "../sentry"

jest.mock("@sentry/node")

describe("Sentry capture helpers", () => {
  describe("prepareContextObject", () => {
    it("Should convert `data` into a compatible format", () => {
      const obj = {
        itemOne: "1",
        itemTwo: 2,
        itemThree: { three: 3 },
        itemFour: [{ one: 1, two: 2, three: 3, four: 4 }],
        itemFive: { one: { two: { three: { four: { five: 5 } } } } },
      }
      const context = prepareContextObject(obj)

      expect(context).toEqual({
        "Other Values": {
          itemOne: "1",
          itemTwo: 2,
        },
        "itemThree": { three: 3 },
        "itemFour": {
          "Index: 0": JSON.stringify(obj.itemFour[0], null, "  "),
          "Index: 1": JSON.stringify(obj.itemFour[1], null, "  "),
          "Index: 2": JSON.stringify(obj.itemFour[2], null, "  "),
          "Index: 3": JSON.stringify(obj.itemFour[3], null, "  "),
        },
        "itemFive": { one: JSON.stringify(obj.itemFive.one, null, "  ") },
      })
    })
  })
})

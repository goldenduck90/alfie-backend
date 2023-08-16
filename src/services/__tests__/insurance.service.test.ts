import {
  InsurancePlanCoverageModel,
  InsurancePlanValue,
  InsuranceTypeValue,
} from "../../schema/insurance.schema"
import { getTestProvider } from "../../utils/tests/createTestDocument"
import { connectToMongo } from "../../utils/tests/mongo"
import InsuranceService from "../insurance.service"

describe("InsuranceService", () => {
  beforeAll(async () => {
    await connectToMongo()
  })

  test("isCovered", async () => {
    const insuranceService = new InsuranceService()
    const testProvider = await getTestProvider()
    await InsurancePlanCoverageModel.create({
      plan: InsurancePlanValue.Humana,
      type: InsuranceTypeValue.EPO,
      provider: testProvider._id,
      state: "FL",
      covered: true,
    })

    const r1 = await insuranceService.isCovered({
      plan: InsurancePlanValue.Humana,
      type: null,
      state: "FL",
    })

    expect(r1.covered).toBe(false)

    const r2 = await insuranceService.isCovered({
      plan: InsurancePlanValue.Humana,
      state: "FL",
      type: InsuranceTypeValue.EPO,
    })

    expect(r2.covered).toBe(true)

    await InsurancePlanCoverageModel.create({
      plan: InsurancePlanValue.Cigna,
      type: null,
      state: "NY",
      provider: testProvider._id,
      covered: true,
    })

    const r3 = await insuranceService.isCovered({
      plan: InsurancePlanValue.Cigna,
      type: InsuranceTypeValue.PPO,
      state: "NY",
    })

    expect(r3.covered).toBe(true)

    const r4 = await insuranceService.isCovered({
      plan: InsurancePlanValue.Other,
      type: InsuranceTypeValue.HMO,
      state: "AZ",
    })
    expect(r4.covered).toBe(false)
  }, 10e3)
})

import { BatchCreateOrUpdateLabsInput, LabModel } from "../schema/lab.schema"

class LabService {
  async batchCreateOrUpdateLabs(input: BatchCreateOrUpdateLabsInput) {
    const { labs } = input
    const bulkOps = labs.map((lab) => ({
      updateOne: {
        filter: {
          faxNumber: lab.faxNumber,
        },
        update: lab,
        upsert: true,
      },
    }))
    const result = await LabModel.bulkWrite(bulkOps)

    return {
      updated: result.modifiedCount,
      created: result.upsertedCount,
    }
  }
}

export default LabService

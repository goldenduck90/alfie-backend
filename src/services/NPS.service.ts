import { NPSModel, NPS as NPSInput } from "../schema/NPS.schema"

class NPSService {
  async createNPS(nps: NPSInput) {
    return await NPSModel.create(nps)
  }
}

export default NPSService

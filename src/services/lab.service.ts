import * as Sentry from "@sentry/node"
import axios from "axios"
import { GooglePlacesSearchInput } from "../schema/googlePlaces.schema"
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

  async getLocationsFromGoogleAutoComplete(input: GooglePlacesSearchInput) {
    try {
      console.log(input)
      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=lat,lng&key=${process.env.GOOGLE_API_KEY}`
      const response = await axios.get(url)
      return response.data.predictions
    } catch (error) {
      Sentry.captureException(error)
      return []
    }
  }
  async getAllLabLocations() {
    try {
      const labLocations = await LabModel.find({})
      return labLocations
    } catch (error) {
      Sentry.captureException(error)
      return []
    }
  }
}

export default LabService

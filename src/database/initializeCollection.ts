import {
  deepEquals,
  mapCollectionByField,
  pickFields,
} from "../utils/collections"
import { ModelType } from "@typegoose/typegoose/lib/types"

/**
 * Allows any value for the fields of `Type`, and allows for partial objects.
 */
export type RawData<Type> = {
  [Property in keyof Type]+?: any
}

/**
 * Initializes a MongoDB collection with raw data, for any missing
 * entries, using data from a JSON file.
 */
export async function initializeCollection<T = any>(
  model: ModelType<T>,
  rawData: RawData<T>[],

  /**
   * Gets a key to uniquely identify a document in the collection.
   * Should not be the `_id` field. May be a concatenation of fields.
   */
  getKey: (doc: T) => string
) {
  const existing = await model.find({})
  const existingByKey = mapCollectionByField(existing, getKey)

  const dataByKey = mapCollectionByField(rawData, getKey)

  const keys = Object.keys(dataByKey)

  const missingDocs = keys
    .filter((key) => !existingByKey[key])
    .map((key) => dataByKey[key])
    .filter((template) => template)

  const newDocs = await Promise.all(
    missingDocs.map(async (doc) => await model.create(doc))
  )
  const changedDocs = await Promise.all(
    keys
      .filter((key) => existingByKey[key])
      .filter((key) => {
        const data = dataByKey[key]
        const existingWithDataKeys = pickFields<any, any>(
          (existingByKey[key] as any).toJSON(),
          ...Object.keys(dataByKey[key])
        )

        if (!deepEquals(data, existingWithDataKeys)) {
          console.log(`Diff: Data:     ${JSON.stringify(data, null, "  ")}`)
          console.log(
            `Diff: Existing: ${JSON.stringify(
              existingWithDataKeys,
              null,
              "  "
            )}`
          )
          return true
        } else {
          return false
        }
      })
      .map((key) => ({
        data: dataByKey[key] as any,
        doc: existingByKey[key] as any,
      }))
      .map(async ({ data, doc }) => {
        await model.findByIdAndUpdate(doc._id, {
          $set: data,
        })
        const updated = await model.findById(doc._id)
        return updated
      })
  )

  // delete documents that do not exist in the rawData
  const docsToDelete = Object.keys(existingByKey)
    .filter((key) => existingByKey[key] && !dataByKey[key])
    .map((key) => existingByKey[key])

  const deletedDocs = await Promise.all(
    docsToDelete.map(async (doc) => {
      await model.findByIdAndDelete((doc as any)._id)
      return doc
    })
  )

  return {
    originalDocuments: existing,
    newDocuments: newDocs,
    changedDocuments: changedDocs,
    deletedDocuments: deletedDocs,
  }
}

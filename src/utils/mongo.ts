import config from "config";
import mongoose from "mongoose";

export async function connectToMongo() {
  try {
    const dbUri = config.get("dbUri")
    console.log(dbUri)
    await mongoose.connect(dbUri)
    console.log("Connected to MongoDB")
  } catch (error) {
    console.error(error)
    process.exit(1)
  }
}

import config from "config"
import mongoose from "mongoose"

export async function connectToMongo() {
  try {
    await mongoose.connect(config.get("dbUri"))
    console.log("Connected to MongoDB")
  } catch (error) {
    console.error(error)
    process.exit(1)
  }
}

import dotenv from "dotenv"
dotenv.config()

import config from "config"
import mongoose from "mongoose"

export async function connectToMongo() {
  try {
    const dbUri = config.get("dbUri") as string
    console.log(dbUri)
    await mongoose.connect(dbUri)
    console.log("Connected to MongoDB database")
  } catch (error) {
    console.error(error)
    process.exit(1)
  }
}

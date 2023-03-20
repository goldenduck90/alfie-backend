import config from "config"
import mongoose from "mongoose"

export async function connectToMongo() {
  try {
    const dbUri = config.get("dbUri") as string
    console.log(dbUri)
    await mongoose.connect(`mongodb+srv://joinalfie_dev_user:${process.env.DB_PASSWORD}@platform-staging-cluste.zn2qm3z.mongodb.net/?retryWrites=true&w=majority`)
    console.log("Connected to MongoDB")
  } catch (error) {
    console.error(error)
    process.exit(1)
  }
}

import mongoose from "mongoose"

export async function connectToMongo() {
  try {
    const dbUri = `mongodb+srv://joinalfie_dev_user:${process.env.DB_PASSWORD}@platform-production-clu.wnd0f.mongodb.net/?retryWrites=true&w=majority` as string
    console.log(dbUri)
    await mongoose.connect(dbUri)
    console.log("Connected to MongoDB")
  } catch (error) {
    console.error(error)
    process.exit(1)
  }
}

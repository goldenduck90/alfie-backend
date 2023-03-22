import config from "config"
import mongoose from "mongoose"

export async function connectToMongo() {
  try {
<<<<<<< HEAD
    console.log(config.get("dbUri"))
    await mongoose.connect(`mongodb+srv://joinalfie_dev_user:${process.env.DB_PASSWORD}@platform-production-clu.wnd0f.mongodb.net/?retryWrites=true&w=majority`)
=======
    const dbUri = config.get("dbUri") as string
    console.log(dbUri)
    await mongoose.connect(dbUri)
>>>>>>> develop
    console.log("Connected to MongoDB")
  } catch (error) {
    console.error(error)
    process.exit(1)
  }
}

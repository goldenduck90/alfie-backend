import { MongoMemoryServer } from "mongodb-memory-server"
import mongoose from "mongoose"

let server: MongoMemoryServer

/** Connect to test mongo DB. */
export const connectToMongo = async () => {
  if (server) {
    return
  }

  try {
    server = await MongoMemoryServer.create()
    await mongoose.connect(server.getUri())

    const cleanup = async () => {
      await disconnect()
      await server?.stop()
      process.exit()
    }
    process.on("SIGINT", cleanup)
    process.on("SIGTERM", cleanup)
  } catch (error) {
    console.log(`Error connecting to in-memory mongo: ${error.message}`)
  }
}

/** Disconnect from the test mongo DB. */
export const disconnect = async () => {
  // no action, closes connection while tests are still running in debug mode.
}

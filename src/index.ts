import express from "express"
import dotenv from "dotenv"
import morganMiddleware from "./middleware/morgan"

dotenv.config()

const app = express()
const port = process.env.PORT || 3000

app.use(morganMiddleware)

app.listen(port, () => {
  console.log(`⚡️[server]: Server is running at https://localhost:${port}`)
})

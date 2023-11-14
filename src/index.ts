import dotenv from "dotenv"
dotenv.config()
import Sentry from "./utils/sentry"
import {
  ApolloServerPluginLandingPageGraphQLPlayground,
  ApolloServerPluginLandingPageProductionDefault,
} from "apollo-server-core"
import { ApolloServer } from "apollo-server-express"
import express, { Request, Response } from "express"
import { expressjwt } from "express-jwt"
import "reflect-metadata"
import { buildSchema } from "type-graphql"
import authChecker from "./middleware/authChecker"
import resolvers from "./resolvers"
import Context from "./types/context"
import { connectToMongo } from "./utils/mongo"
import * as cron from "node-cron"
import UserService from "./services/user.service"
import MetriportService, {
  ConsolidatedPatient,
  ConversionPatient,
  MetriportUser,
} from "./services/metriport.service"
import StripeService from "./services/stripe.service"
import { initializeSendBirdWebhook } from "./utils/sendBird"
import TaskService from "./services/task.service"
import { Gender } from "./schema/user.schema"

const userService = new UserService()
const metriportService = new MetriportService()
const taskService = new TaskService()

async function bootstrap() {
  const path = "/graphql"

  // build the schema
  const schema = await buildSchema({
    resolvers,
    authChecker,
  })

  // init express
  const app = express()

  // create the apollo server
  const server = new ApolloServer({
    schema,
    context: (ctx: Context) => {
      const context = ctx.req
      // req.user is set by the jwt middleware
      context.user = ctx.req.auth
      return context
    },
    plugins: [
      process.env.NODE_ENV === "production"
        ? ApolloServerPluginLandingPageProductionDefault()
        : ApolloServerPluginLandingPageGraphQLPlayground(),
    ],
  })

  // mount jwt middleware & run before the GraphQL execution
  app.use(
    path,
    express.json(),
    expressjwt({
      secret: process.env.JWT_SECRET,
      credentialsRequired: false,
      algorithms: ["HS256"],
      ignoreExpiration: true,
    })
  )

  // start apollo server
  await server.start()

  // apply middleware to server
  server.applyMiddleware({
    app,
    path,
  })

  // stripe webhook listener
  new StripeService().initializeWebhook(app)

  // sendbird webhook listener
  initializeSendBirdWebhook(app)

  app.post(
    "/metriportWebhooks",
    express.json(),
    async (req: Request, res: Response) => {
      try {
        const key = req.get("x-webhook-key")
        if (key !== process.env.METRIPORT_WEBHOOK_KEY) {
          return res.sendStatus(401)
        }

        const { ping, meta, users } = req.body

        if (ping) {
          return res.status(200).send({
            pong: ping,
          })
        }

        if (!meta || !users) {
          return res.status(400).send({
            message: "Bad Request",
          })
        }

        console.log(req.body)

        switch (meta.type) {
          case "medical.document-conversion":
            const conversionPatients: ConversionPatient[] = req.body.patients
            const seenConversionPatientIds: Record<string, boolean> = {}
            const filteredConversionPatients = conversionPatients.filter(
              (patient) => {
                if (!seenConversionPatientIds[patient.patientId]) {
                  seenConversionPatientIds[patient.patientId] = true
                  return true
                }
                return false
              }
            )

            for (const patient of filteredConversionPatients) {
              await metriportService.startConsolidatedDataQuery({
                metriportPatientId: patient.patientId,
              })
            }
            break
          case "medical.consolidated-data":
            const consolidatedPatients: ConsolidatedPatient[] =
              req.body.patients
            const seenConsolidatedPatientIds: Record<string, boolean> = {}
            const filteredConsolidatedPatients = consolidatedPatients.filter(
              (patient) => {
                if (!seenConsolidatedPatientIds[patient.patientId]) {
                  seenConsolidatedPatientIds[patient.patientId] = true
                  return true
                }
                return false
              }
            )

            for (const patient of filteredConsolidatedPatients) {
              const success = await metriportService.parseConsolidatedData({
                metriportPatientId: patient.patientId,
                resources: patient.filters.resources.split(","),
                entries: patient.bundle.entry,
              })

              if (!success) {
                console.log(patient)
                throw Error("An error occured parsing consolidated data")
              }
            }
            break
          case "devices.provider-connected":
            await Promise.all(
              users.map(async (metriportUser: MetriportUser) => {
                const { userId, providers } = metriportUser
                if (providers.includes("withings")) {
                  await userService.processWithingsScaleConnected(userId)
                }
              })
            )
            break
          case "devices.health-data":
            await Promise.all(
              users.map(async (metriportUser: MetriportUser) => {
                const { userId, body } = metriportUser
                if (body?.[0]?.weight_samples_kg) {
                  const weightLbs = Math.floor(
                    body[0].weight_samples_kg[0].value * 2.2
                  )
                  const timeCompleted = body[0].weight_samples_kg[0].time
                  await userService.processWithingsScaleReading(
                    userId,
                    weightLbs,
                    timeCompleted
                  )
                }
              })
            )
            break
          default:
            break
        }

        return res
          .status(200)
          .send({ message: "Webhook processed successfully" })
      } catch (err) {
        console.log(err)
        Sentry.captureException(err)
        res.sendStatus(500)
      }
    }
  )

  // app.listen on express server
  app.listen({ port: process.env.PORT || 4000 }, async () => {
    console.log(
      `App is listening on http://localhost:4000${server.graphqlPath}`
    )
  })

  // connect to mongodb
  connectToMongo()
}

cron.schedule("0 0 * * *", async () => {
  console.log(`[TASK JOB][${new Date().toString()}] RUNNING...`)
  await userService.taskJob()
  console.log(`[TASK JOB][${new Date().toString()}] COMPLETED`)
})

cron.schedule(
  "0 * * * *",
  async () => {
    console.log(`[METRIPORT DOCUMENT JOB][${new Date().toString()}] RUNNING...`)
    await metriportService.runPatientJob()
    console.log(`[METRIPORT DOCUMENT JOB][${new Date().toString()}] COMPLETED`)
  },
  {
    runOnInit: true,
  }
)

cron.schedule("0 0 * * *", async () => {
  console.log(`[SCHEDULE APPOINTMENT JOB][${new Date().toString()}] RUNNING...`)
  const users = await userService.getAllUsers()
  for (const user of users) {
    await taskService.checkEligibilityForAppointment(user._id)
  }
  console.log(`[SCHEDULE APPOINTMENT JOB][${new Date().toString()}] COMPLETED`)
})

bootstrap()

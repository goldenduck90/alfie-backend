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
import { MetriportUser } from "./services/metriport.service"
import StripeService from "./services/stripe.service"
import { initializeSendBirdWebhook } from "./utils/sendBird"

const userService = new UserService()

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
      console.log(req.body)
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

        switch (meta.type) {
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
                  const weightLbs = Math.floor(body[0].weight_samples_kg * 2.2)
                  await userService.processWithingsScaleReading(
                    userId,
                    weightLbs
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

bootstrap()

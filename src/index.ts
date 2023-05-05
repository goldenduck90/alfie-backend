import * as Sentry from "@sentry/node"
import {
  ApolloServerPluginLandingPageGraphQLPlayground,
  ApolloServerPluginLandingPageProductionDefault,
} from "apollo-server-core"
import { ApolloServer } from "apollo-server-express"
import * as AWS from "aws-sdk"
import dotenv from "dotenv"
import express from "express"
import { expressjwt } from "express-jwt"
import "reflect-metadata"
import { buildSchema } from "type-graphql"
import authChecker from "./middleware/authChecker"
import resolvers from "./resolvers"
import { ProviderModel } from "./schema/provider.schema"
import { Role, UserModel } from "./schema/user.schema"
import Context from "./types/context"
import { connectToMongo } from "./utils/mongo"
import * as cron from "node-cron"
import UserService from "./services/user.service"

dotenv.config()

// import * as Tracing from '@sentry/tracing';
Sentry.init({
  dsn: "https://e99c3274029e405f9e1b6dd50a63fd85@o4504040965603328.ingest.sentry.io/4504040986705920",
  environment: process.env.NODE_ENV,
  // Set tracesSampleRate to 1.0 to capture 100%
  // of transactions for performance monitoring.
  // We recommend adjusting this value in production
  tracesSampleRate: 1.0,
})

async function bootstrap() {
  const path = "/graphql"

  // build the schema
  const schema = await buildSchema({
    resolvers,
    authChecker,
  })

  // init express
  const app = express()
  app.use(express.json())

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
    expressjwt({
      secret: process.env.JWT_SECRET,
      credentialsRequired: false,
      algorithms: ["HS256"],
    })
  )

  // start apollo server
  await server.start()

  // apply middleware to server
  server.applyMiddleware({
    app,
    path,
  })

  const ses = new AWS.SES({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION,
  })

  // webhook listener
  app.post("/sendbirdWebhooks", express.json(), async (req, res) => {
    try {
      const signature = req.get("x-sendbird-signature")
      console.log(req.body, signature)

      const {
        sender,
        payload: { message },
        members,
      } = req.body

      const foundUserEmailAddresses = members.map(async (member: any) => {
        const foundEmails = []
        const emailsToSendTo = await UserModel.findOne({
          _id: member.user_id,
        })
        foundEmails.push(emailsToSendTo)
        if (!emailsToSendTo) {
          const foundOnProviderTable = await ProviderModel.findOne({
            _id: member.user_id,
          })
          foundEmails.push(foundOnProviderTable)
        }
        return foundEmails
      })
      const emailsToSendTo = (await Promise.all(foundUserEmailAddresses)).flat()
      const filteredEmailsToSendTo = emailsToSendTo.filter(
        (email) => email !== null
      )
      const possibleSender = await UserModel.findOne({ _id: sender.user_id })
      if (possibleSender?.role === Role.Patient) {
        const filteredEmailsToSendToBasedOnRole = filteredEmailsToSendTo.filter(
          (user) => String(user._id) !== String(possibleSender._id)
        )
        const mapToEmails = filteredEmailsToSendToBasedOnRole.map(
          (user: any) => user.email
        )
        const params = {
          Source: "no-reply@joinalfie.com",
          Destination: {
            ToAddresses: mapToEmails,
          },
          ReplyToAddresses: [] as string[],
          Message: {
            Body: {
              Html: {
                Charset: "UTF-8",
                Data: `
          You have unread messages from ${sender.nickname}
                    <br />
          <br />
          Sender: ${sender.nickname}
          <br />
          <br />
          Message: ${message}
          .          
          `,
              },
            },
            Subject: {
              Charset: "UTF-8",
              Data: `Unread Messages in Channel by ${sender.nickname}`,
            },
          },
        }
        await ses.sendEmail(params).promise()
        return res.sendStatus(200)
      } else {
        // this is an admin, health coach or practitioner so we just send the email to the patient
        const filteredEmailsToSendToBasedOnRole = filteredEmailsToSendTo.filter(
          (user) =>
            user.type !== Role.Practitioner &&
            user.role !== Role.Admin &&
            user.role !== Role.HealthCoach
        )
        const mapToEmails = filteredEmailsToSendToBasedOnRole.map(
          (user: any) => user.email
        )
        const params = {
          Source: "no-reply@joinalfie.com",
          Destination: {
            ToAddresses: mapToEmails,
          },
          ReplyToAddresses: [] as string[],
          Message: {
            Body: {
              Html: {
                Charset: "UTF-8",
                Data: `
                Hi ${filteredEmailsToSendToBasedOnRole[0]?.name},

                  You have a new message from your Care Team. To read it, simply click the button below:
                  <br />
                  <br />

                  <a href="https://app.joinalfie.com/chat">Read Message</a>

                  <br />
                  <br />
                  
                  If you have any questions, let us know through the messaging portal!

                  <br />
                  <br />
                  Your Care Team`,
              },
            },
            Subject: {
              Charset: "UTF-8",
              Data: "New Message from your Care Team",
            },
          },
        }
        await ses.sendEmail(params).promise()
      }
      res.sendStatus(200)
    } catch (error) {
      console.log(error, "error")
      res.sendStatus(500)
    }
  })

  // app.listen on express server
  app.listen({ port: process.env.PORT || 4000 }, async () => {
    console.log(
      `App is listening on http://localhost:4000${server.graphqlPath}`
    )
  })

  // connect to mongodb
  connectToMongo()
}

// run task job
cron.schedule("0 0 * * *", async () => {
  console.log("[TASK JOB] RUNNING...")
  const userService = new UserService()
  await userService.taskJob()
  console.log("[TASK JOB] COMPLETED")
})

bootstrap()

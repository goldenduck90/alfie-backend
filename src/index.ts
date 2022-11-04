import dotenv from "dotenv"
dotenv.config()
import "reflect-metadata"
import express from "express"
import { ApolloServer } from "apollo-server-express"
import { buildSchema } from "type-graphql"
import { expressjwt } from "express-jwt"
import {
  ApolloServerPluginLandingPageGraphQLPlayground,
  ApolloServerPluginLandingPageProductionDefault,
} from "apollo-server-core"
import resolvers from "./resolvers"
import { connectToMongo } from "./utils/mongo"
import authChecker from "./middleware/authChecker"
import Context from "./types/context"
import * as Sentry from "@sentry/node"
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

  // app.listen on express server
  app.listen({ port: process.env.PORT || 4000 }, () => {
    console.log(
      `App is listening on http://localhost:4000${server.graphqlPath}`
    )
  })

  // connect to mongodb
  connectToMongo()
}

bootstrap()

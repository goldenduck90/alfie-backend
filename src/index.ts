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
import authChecker from "./utils/authChecker"
import Context from "./types/context"

async function bootstrap() {
  const path = "/graphql"

  // build the schema
  const schema = await buildSchema({
    resolvers,
    authChecker,
  })

  // init express
  const app = express()

  // mount jwt middleware & run before the GraphQL execution
  app.use(
    path,
    expressjwt({
      secret: process.env.JWT_SECRET,
      credentialsRequired: false,
      algorithms: ["HS256"],
    })
  )

  // create the apollo server
  const server = new ApolloServer({
    schema,
    context: (ctx: Context) => {
      const context = ctx
      // req.user is set by the jwt middleware
      context.user = ctx.req.user
      return context
    },
    plugins: [
      process.env.NODE_ENV === "production"
        ? ApolloServerPluginLandingPageProductionDefault()
        : ApolloServerPluginLandingPageGraphQLPlayground(),
    ],
  })

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

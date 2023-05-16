/* eslint-disable no-case-declarations */
import * as Sentry from "@sentry/node"
import {
  ApolloServerPluginLandingPageGraphQLPlayground,
  ApolloServerPluginLandingPageProductionDefault,
} from "apollo-server-core"
import { ApolloServer } from "apollo-server-express"
import * as AWS from "aws-sdk"
import dotenv from "dotenv"
import express, { Request, Response } from "express"
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
import stripe from "stripe"
import { CheckoutModel } from "./schema/checkout.schema"
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

const Stripe = new stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2022-08-01",
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

  app.post(
    "/stripeWebhooks",
    express.json(),
    async (req: Request, res: Response) => {
      const stripeSignature = req.headers["stripe-signature"]
      const userService = new UserService()

      let event

      try {
        event = Stripe.webhooks.constructEvent(
          req.body,
          stripeSignature,
          process.env.STRIPE_WEBHOOK_SECRET
        )
      } catch (err) {
        console.log("[STRIPE WEBHOOK] Error decoding event")
        console.log(err)
        Sentry.captureException(err)
        return res
          .status(500)
          .send(`[STRIPE WEBHOOK] Error decoding event: ${err.message}`)
      }

      const dataObject = event.data.object as any

      if (dataObject.metadata?.CREATED_VIA_STRIPE_WEBHOOK !== "TRUE") {
        console.log(
          `[STRIPE WEBHOOK] IGNORING EVENT AS IT WAS NOT CREATED VIA PLATFORM: ${dataObject.id}`
        )
        return res.status(200).send({
          code: 200,
          message: `[STRIPE WEBHOOK] IGNORING EVENT AS IT WAS NOT CREATED VIA PLATFORM: ${dataObject.id}`,
        })
      }

      switch (event.type) {
        case "setup_intent.succeeded":
          let ignoreCheckout = false
          if (dataObject.metadata?.IGNORE_CHECKOUT === "TRUE") {
            ignoreCheckout = true
          }

          const checkout = await CheckoutModel.findOne({
            setupIntentId: dataObject.id,
          })

          if (!checkout && !ignoreCheckout) {
            console.log(
              `[STRIPE WEBHOOK] [EVENT: setup_intent.succeeded] Checkout not found for setup intent ID: ${dataObject.id}`
            )
            console.log(
              JSON.stringify({
                setupIntentId: dataObject.id,
                ignoreCheckout: false,
              })
            )
            Sentry.captureException(
              `Checkout not found for setup intent ID: ${dataObject.id}`,
              {
                tags: {
                  setupIntentId: dataObject.id,
                  ignoreCheckout: false,
                },
              }
            )
            return res.status(400).send({
              code: 400,
              message: `Checkout not found for setup intent ID: ${dataObject.id}`,
              data: {
                setupIntentId: dataObject.id,
                ignoreCheckout: false,
              },
            })
          }

          let stripeCustomerId =
            typeof dataObject.customer === "object" &&
            dataObject.customer !== null
              ? dataObject.customer.id
              : dataObject.customer
          const paymentMethodId =
            typeof dataObject.payment_method === "object" &&
            dataObject.payment_method !== null
              ? dataObject.payment_method.id
              : dataObject.payment_method

          if (ignoreCheckout && !stripeCustomerId) {
            console.log(
              `[STRIPE WEBHOOK] [EVENT: setup_intent.succeeded] Cannot ignore checkout if stripeCustomerId is not set on setupIntent: ${dataObject.id}`
            )
            console.log(
              JSON.stringify({
                setupIntentId: dataObject.id,
                stripeCustomerId,
                ignoreCheckout,
                ...(!ignoreCheckout &&
                  checkout && { checkoutId: checkout._id }),
              })
            )
            Sentry.captureException(
              `Cannot ignore checkout if stripeCustomerId is not set on setupIntent: ${dataObject.id}`,
              {
                tags: {
                  setupIntentId: dataObject.id,
                  stripeCustomerId,
                  ignoreCheckout,
                  ...(!ignoreCheckout &&
                    checkout && { checkoutId: checkout._id }),
                },
              }
            )
            return res.status(400).send({
              code: 400,
              message: `Cannot ignore checkout if stripeCustomerId is not set on setupIntent: ${dataObject.id}`,
              data: {
                setupIntentId: dataObject.id,
                stripeCustomerId,
                ignoreCheckout,
                ...(!ignoreCheckout &&
                  checkout && { checkoutId: checkout._id }),
              },
            })
          }

          if (!stripeCustomerId) {
            try {
              const shippingAddress = {
                line1: checkout.shippingAddress.line1,
                line2: checkout.shippingAddress.line2,
                city: checkout.shippingAddress.city,
                state: checkout.shippingAddress.state,
                country: "United States",
              }

              const stripeCustomer = await Stripe.customers.create({
                name: checkout.name,
                payment_method: paymentMethodId,
                email: checkout.email,
                phone: checkout.phone,
                invoice_settings: {
                  default_payment_method: paymentMethodId,
                },
                shipping: {
                  name: checkout.name,
                  phone: checkout.phone,
                  address: {
                    line1: checkout.shippingAddress.line1,
                    line2: checkout.shippingAddress.line2,
                    city: checkout.shippingAddress.city,
                    state: checkout.shippingAddress.state,
                    country: "United States",
                  },
                },
                address: checkout.sameAsShippingAddress
                  ? shippingAddress
                  : {
                      line1: checkout.billingAddress.line1,
                      line2: checkout.billingAddress.line2,
                      city: checkout.billingAddress.city,
                      state: checkout.billingAddress.state,
                      country: "United States",
                    },
                metadata: {
                  CREATED_VIA_STRIPE_WEBHOOK: "TRUE",
                  ORIGINAL_CHECKOUT_ID: checkout._id,
                },
              })

              checkout.stripeCustomerId = stripeCustomer.id
              stripeCustomerId = stripeCustomer.id

              await checkout.save()

              // update setup intent to set new stripe customer on it
              try {
                await Stripe.setupIntents.update(dataObject.id, {
                  customer: stripeCustomer.id,
                })
              } catch (err) {
                console.log(
                  `[STRIPE WEBHOOK] [EVENT: setup_intent.succeeded] An error occured setting stripeCustomerId (${stripeCustomer.id}) on setupIntent: ${dataObject.id}`
                )
                console.log(
                  JSON.stringify({
                    setupIntentId: dataObject.id,
                    stripeCustomerId,
                    ignoreCheckout,
                    ...(!ignoreCheckout &&
                      checkout && { checkoutId: checkout._id }),
                  })
                )
                console.log(err)
                Sentry.captureException(err, {
                  tags: {
                    setupIntentId: dataObject.id,
                    stripeCustomerId,
                    ignoreCheckout,
                    ...(!ignoreCheckout &&
                      checkout && { checkoutId: checkout._id }),
                  },
                })
                return res.status(500).send({
                  code: 500,
                  message: `An error occured setting stripeCustomerId (${stripeCustomer.id}) on setupIntent: ${dataObject.id}`,
                  data: {
                    setupIntentId: dataObject.id,
                    stripeCustomerId,
                    ignoreCheckout,
                    ...(!ignoreCheckout &&
                      checkout && { checkoutId: checkout._id }),
                  },
                  error: JSON.stringify(err),
                })
              }
            } catch (err) {
              console.log(
                `[STRIPE WEBHOOK] [EVENT: setup_intent.succeeded] An error occured creating stripe customer for setupIntent: ${dataObject.id}`
              )
              console.log(
                JSON.stringify({
                  setupIntentId: dataObject.id,
                  stripeCustomerId,
                  ignoreCheckout,
                  ...(!ignoreCheckout &&
                    checkout && { checkoutId: checkout._id }),
                })
              )
              console.log(err)
              Sentry.captureException(err, {
                tags: {
                  setupIntentId: dataObject.id,
                  stripeCustomerId,
                  ignoreCheckout,
                  ...(!ignoreCheckout &&
                    checkout && { checkoutId: checkout._id }),
                },
              })
              return res.status(500).send({
                code: 500,
                message: `[STRIPE WEBHOOK] [EVENT: setup_intent.succeeded] An error occured creating stripe customer for setupIntent: ${dataObject.id}`,
                data: {
                  setupIntentId: dataObject.id,
                  stripeCustomerId,
                  ignoreCheckout,
                  ...(!ignoreCheckout &&
                    checkout && { checkoutId: checkout._id }),
                },
                error: JSON.stringify(err),
              })
            }
          }

          // create subscription
          try {
            const stripeSubscription = await Stripe.subscriptions.create({
              customer: stripeCustomerId,
              items: [{ price: "" }],
              default_payment_method: paymentMethodId,
              collection_method: "charge_automatically",
              metadata: {
                CREATED_VIA_STRIPE_WEBHOOK: "TRUE",
                ...(!ignoreCheckout &&
                  checkout && { ORIGINAL_CHECKOUT_ID: checkout._id }),
              },
            })

            const tags = {
              setupIntentId: dataObject.id,
              stripeCustomerId,
              stripeSubscriptionId: stripeSubscription.id,
              ignoreCheckout,
              ...(!ignoreCheckout && checkout && { checkoutId: checkout._id }),
            }

            if (!ignoreCheckout && checkout) {
              checkout.stripeSubscriptionId = stripeSubscription.id
              await checkout.save()
              console.log(
                `[STRIPE WEBHOOK] [EVENT: setup_intent.succeeded] Successfully Saved "stripeSubscriptionId" on checkout: ${checkout._id}`
              )
              Sentry.captureMessage(
                `[STRIPE WEBHOOK] [EVENT: setup_intent.succeeded] Successfully Saved "stripeSubscriptionId" on checkout: ${checkout._id}`,
                {
                  tags,
                }
              )
            }

            console.log(
              "[STRIPE WEBHOOK] [EVENT: setup_intent.succeeded] Successfully Processed Event"
            )
            console.log(JSON.stringify(tags))
            Sentry.captureMessage(
              "[STRIPE WEBHOOK] [EVENT: setup_intent.succeeded] Successfully Processed Event",
              {
                tags,
              }
            )
            return res.status(200).send({
              code: 200,
              message:
                "[STRIPE WEBHOOK] [EVENT: setup_intent.succeeded] Successfully Processed Event",
              data: tags,
            })
          } catch (err) {
            console.log(
              `[STRIPE WEBHOOK] [EVENT: setup_intent.succeeded] An error occured creating subscription for stripeCustomer (${stripeCustomerId}) and setupIntent: ${dataObject.id}`
            )
            console.log(
              JSON.stringify({
                setupIntentId: dataObject.id,
                stripeCustomerId,
                ignoreCheckout,
                ...(!ignoreCheckout &&
                  checkout && { checkoutId: checkout._id }),
              })
            )
            console.log(err)
            Sentry.captureException(err, {
              tags: {
                setupIntentId: dataObject.id,
                stripeCustomerId,
                ignoreCheckout,
                ...(!ignoreCheckout &&
                  checkout && { checkoutId: checkout._id }),
              },
            })
            return res.status(500).send({
              code: 500,
              message: `An error occured creating subscription for stripeCustomer (${stripeCustomerId}) and setupIntent: ${dataObject.id}`,
              data: {
                setupIntentId: dataObject.id,
                stripeCustomerId,
                ignoreCheckout,
                ...(!ignoreCheckout &&
                  checkout && { checkoutId: checkout._id }),
              },
              error: JSON.stringify(err),
            })
          }

        // subscription created
        case "customer.subscription.created":
          const newStripeSubscriptionId = dataObject.id
          const newStripeCustomerId = dataObject.customer

          if (!newStripeCustomerId) {
            console.log(
              `[STRIPE WEBHOOK] [EVENT: customer.subscription.created] No stripe customer id present on subscription id: ${newStripeCustomerId}`
            )
            console.log(
              JSON.stringify({
                stripeSubscriptionId: newStripeSubscriptionId,
                stripeCustomerId: newStripeCustomerId,
              })
            )
            Sentry.captureException(
              `[STRIPE WEBHOOK] [EVENT: customer.subscription.created] No stripe customer id present on subscription id: ${newStripeCustomerId}`,
              {
                tags: {
                  stripeSubscriptionId: newStripeSubscriptionId,
                  stripeCustomerId: newStripeCustomerId,
                },
              }
            )
            return res.status(500).send({
              code: 400,
              message: `[STRIPE WEBHOOK] [EVENT: customer.subscription.created] No stripe customer id present on subscription id: ${newStripeCustomerId}`,
              data: {
                stripeSubscriptionId: newStripeSubscriptionId,
                stripeCustomerId: newStripeCustomerId,
              },
            })
          }

          try {
            const existingUser = await UserModel.findOne({
              stripeCustomerId: newStripeCustomerId,
            })
            if (existingUser) {
              existingUser.stripeSubscriptionId = newStripeSubscriptionId
              existingUser.subscriptionExpiresAt = new Date(
                dataObject.current_period_end * 1000
              )
              await existingUser.save()

              await Stripe.subscriptions.update(newStripeSubscriptionId, {
                metadata: {
                  USER_ID: existingUser._id,
                },
              })

              await Stripe.customers.update(newStripeCustomerId, {
                metadata: {
                  USER_ID: existingUser._id,
                },
              })

              // TODO: send email to user that subscription has been updated
            }
          } catch (err) {
            console.log(
              `[STRIPE WEBHOOK] [EVENT: customer.subscription.created] An error occured updating existing user with stripe subscription id: ${dataObject.id}`
            )
            console.log(
              JSON.stringify({
                stripeSubscriptionId: newStripeSubscriptionId,
                stripeCustomerId: newStripeCustomerId,
              })
            )
            console.log(err)
            Sentry.captureException(err, {
              tags: {
                stripeSubscriptionId: newStripeSubscriptionId,
                stripeCustomerId: newStripeCustomerId,
              },
            })
            return res.status(500).send({
              code: 500,
              message: `[STRIPE WEBHOOK] [EVENT: customer.subscription.created] An error occured updating existing user with stripe subscription id: ${dataObject.id}`,
              data: {
                stripeSubscriptionId: newStripeSubscriptionId,
                stripeCustomerId: newStripeCustomerId,
              },
            })
          }

          // create new user
          try {
            const newCheckout = await CheckoutModel.findOne({
              stripeSubscriptionId: newStripeSubscriptionId,
            })
            if (!checkout) {
              throw new Error(
                `Checkout not found for stripe subscription id: ${newStripeSubscriptionId}`
              )
            }

            try {
              const newUser = await userService.createUser({
                name: newCheckout.name,
                textOptIn: newCheckout.textOptIn,
                email: newCheckout.email,
                dateOfBirth: newCheckout.dateOfBirth,
                address: newCheckout.shippingAddress,
                weightInLbs: newCheckout.weightInLbs,
                gender: newCheckout.gender,
                heightInInches: newCheckout.heightInInches,
                stripeCustomerId: newStripeCustomerId,
                stripeSubscriptionId: newStripeSubscriptionId,
                subscriptionExpiresAt: new Date(),
              })

              await Stripe.subscriptions.update(newStripeSubscriptionId, {
                metadata: {
                  USER_ID: newUser.user._id,
                },
              })

              await Stripe.customers.update(newStripeCustomerId, {
                metadata: {
                  USER_ID: newUser.user._id,
                },
              })
            } catch (err) {}
          } catch (err) {
            console.log(
              `[STRIPE WEBHOOK] [EVENT: customer.subscription.created] Checkout not found for stripe subscription ID: ${dataObject.id}`
            )
            console.log(
              JSON.stringify({
                stripeSubscriptionId: newStripeSubscriptionId,
                stripeCustomerId: newStripeCustomerId,
              })
            )
            Sentry.captureException(err, {
              tags: {
                stripeSubscriptionId: newStripeSubscriptionId,
                stripeCustomerId: newStripeCustomerId,
              },
            })
            return res.status(500).send({
              code: 500,
              message: `Checkout not found for stripe subscription ID: ${dataObject.id}`,
              data: {
                stripeSubscriptionId: newStripeSubscriptionId,
                stripeCustomerId: newStripeCustomerId,
              },
            })
          }
          break

        case "customer.subscription.updated":
          break

        case "customer.subscription.cancelled":
          break
      }
    }
  )

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

                  <a href="https://app.joinalfie.com/dashboard/chat">Read Message</a>

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

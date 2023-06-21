/* eslint-disable no-case-declarations */
import dotenv from "dotenv"
dotenv.config()
import Sentry from "./utils/sentry"
import {
  ApolloServerPluginLandingPageGraphQLPlayground,
  ApolloServerPluginLandingPageProductionDefault,
} from "apollo-server-core"
import { ApolloServer } from "apollo-server-express"
import * as AWS from "aws-sdk"
import express, { Request, Response } from "express"
import { expressjwt } from "express-jwt"
import "reflect-metadata"
import { buildSchema } from "type-graphql"
import authChecker from "./middleware/authChecker"
import resolvers from "./resolvers"
import { ProviderModel } from "./schema/provider.schema"
import { UserModel } from "./schema/user.schema"
import Role from "./schema/enums/Role"
import Context from "./types/context"
import { connectToMongo } from "./utils/mongo"
import * as cron from "node-cron"
import UserService from "./services/user.service"
import AppointmentService from "./services/appointment.service"
import { MetriportUser } from "./services/metriport.service"
import stripe from "stripe"
import { CheckoutModel } from "./schema/checkout.schema"
import config from "config"

const Stripe = new stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2022-08-01",
})
const userService = new UserService()
const appointmentService = new AppointmentService()

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

  const ses = new AWS.SES({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION,
  })

  app.post(
    "/stripeWebhooks",
    express.raw({ type: "application/json" }),
    async (req: Request, res: Response) => {
      const stripeSignature = req.headers["stripe-signature"]
      const stripeSubscriptonPriceId = config.get("defaultPriceId") as string

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
      const time = new Date().toString()

      switch (event.type) {
        case "setup_intent.succeeded":
          const sEId = dataObject.id
          let ignoreCheckout = false
          const insurancePay = dataObject.metadata?.INSURANCE === "TRUE"

          if (dataObject.metadata?.IGNORE_CHECKOUT === "TRUE") {
            ignoreCheckout = true
          }

          const sECheckout = await CheckoutModel.findOne({
            stripeSetupIntentId: dataObject.id,
          })

          if (!sECheckout && !ignoreCheckout) {
            console.log(
              `[STRIPE WEBHOOK][TIME: ${time}][EVENT: setup_intent.succeeded] Checkout not found for setup intent id: ${sEId}`
            )
            console.log(
              JSON.stringify({
                setupIntentId: dataObject.id,
                ignoreCheckout: false,
              })
            )
            Sentry.captureException(
              `[STRIPE WEBHOOK][TIME: ${time}][EVENT: setup_intent.succeeded] Checkout not found for setup intent id: ${sEId}`,
              {
                tags: {
                  setupIntentId: dataObject.id,
                  ignoreCheckout: false,
                },
              }
            )
            return res.status(400).send({
              code: 400,
              message: `Checkout not found for setup intent id: ${sEId}`,
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
              `[STRIPE WEBHOOK][TIME: ${time}][EVENT: setup_intent.succeeded] Cannot ignore checkout if stripeCustomerId is not set on setupIntent: ${sEId}`
            )
            console.log(
              JSON.stringify({
                setupIntentId: dataObject.id,
                stripeCustomerId,
                ignoreCheckout,
                ...(!ignoreCheckout &&
                  sECheckout && { checkoutId: sECheckout._id }),
              })
            )
            Sentry.captureException(
              `[STRIPE WEBHOOK][TIME: ${time}][EVENT: setup_intent.succeeded] Cannot ignore checkout if stripeCustomerId is not set on setup intent: ${sEId}`,
              {
                tags: {
                  setupIntentId: sEId,
                  stripeCustomerId,
                  ignoreCheckout,
                  ...(!ignoreCheckout &&
                    sECheckout && { checkoutId: sECheckout._id }),
                },
              }
            )
            return res.status(400).send({
              code: 400,
              message: `Cannot ignore checkout if stripeCustomerId is not set on setup intent: ${sEId}`,
              data: {
                setupIntentId: sEId,
                stripeCustomerId,
                ignoreCheckout,
                ...(!ignoreCheckout &&
                  sECheckout && { checkoutId: sECheckout._id }),
              },
            })
          }

          if (!stripeCustomerId) {
            try {
              const shippingAddress = {
                line1: sECheckout.shippingAddress.line1,
                line2: sECheckout.shippingAddress.line2,
                city: sECheckout.shippingAddress.city,
                state: sECheckout.shippingAddress.state,
                country: "United States",
              }

              const stripeCustomer = await Stripe.customers.create({
                name: sECheckout.name,
                payment_method: paymentMethodId,
                email: sECheckout.email,
                phone: sECheckout.phone,
                invoice_settings: {
                  default_payment_method: paymentMethodId,
                },
                shipping: {
                  name: sECheckout.name,
                  phone: sECheckout.phone,
                  address: {
                    line1: sECheckout.shippingAddress.line1,
                    line2: sECheckout.shippingAddress.line2,
                    city: sECheckout.shippingAddress.city,
                    state: sECheckout.shippingAddress.state,
                    country: "United States",
                  },
                },
                address: sECheckout.sameAsShippingAddress
                  ? shippingAddress
                  : {
                      line1: sECheckout.billingAddress.line1,
                      line2: sECheckout.billingAddress.line2,
                      city: sECheckout.billingAddress.city,
                      state: sECheckout.billingAddress.state,
                      country: "United States",
                    },
                metadata: {
                  CREATED_VIA_STRIPE_WEBHOOK_ON: new Date().toString(),
                  ORIGINAL_CHECKOUT_ID: sECheckout._id,
                },
              })

              sECheckout.stripeCustomerId = stripeCustomer.id
              stripeCustomerId = stripeCustomer.id

              await sECheckout.save()
            } catch (err) {
              console.log(
                `[STRIPE WEBHOOK][TIME: ${time}][EVENT: setup_intent.succeeded] An error occured creating stripe customer for setup intent: ${sEId}`
              )
              console.log(
                JSON.stringify({
                  setupIntentId: dataObject.id,
                  stripeCustomerId,
                  ignoreCheckout,
                  ...(!ignoreCheckout &&
                    sECheckout && { checkoutId: sECheckout._id }),
                })
              )
              console.log(err)
              Sentry.captureException(err, {
                tags: {
                  setupIntentId: dataObject.id,
                  stripeCustomerId,
                  ignoreCheckout,
                  ...(!ignoreCheckout &&
                    sECheckout && { checkoutId: sECheckout._id }),
                },
              })
              return res.status(500).send({
                code: 500,
                message: `[STRIPE WEBHOOK][TIME: ${time}][EVENT: setup_intent.succeeded] An error occured creating stripe customer for setup intent: ${sEId}`,
                data: {
                  setupIntentId: dataObject.id,
                  stripeCustomerId,
                  ignoreCheckout,
                  ...(!ignoreCheckout &&
                    sECheckout && { checkoutId: sECheckout._id }),
                },
                error: JSON.stringify(err),
              })
            }
          }

          // create subscription or payment intent
          if (insurancePay) {
            try {
              const stripePayment = await Stripe.paymentIntents.create({
                customer: stripeCustomerId,
                payment_method: paymentMethodId,
                amount: 6900,
                currency: "USD",
                off_session: "one_off",
                confirm: true,
                description: "Alfie - One Time Fee",
                metadata: {
                  CREATED_VIA_STRIPE_WEBHOOK_ON: new Date().toString(),
                  ...(!ignoreCheckout &&
                    sEId && { ORIGINAL_CHECKOUT_ID: sEId._id }),
                },
              })

              const tags = {
                setupIntentId: dataObject.id,
                stripeCustomerId,
                ignoreCheckout,
                ...(!ignoreCheckout &&
                  sECheckout && { checkoutId: sECheckout._id }),
                paymentIntentId: stripePayment.id,
              }

              console.log(
                `[STRIPE WEBHOOK][TIME: ${time}][EVENT: setup_intent.succeeded] Successfully Processed Event`
              )
              console.log(JSON.stringify(tags))
              Sentry.captureMessage(
                `[STRIPE WEBHOOK][TIME: ${time}][EVENT: setup_intent.succeeded] Successfully Processed Event`,
                {
                  tags,
                }
              )
              return res.status(200).send({
                code: 200,
                message: `[STRIPE WEBHOOK][TIME: ${time}][EVENT: setup_intent.succeeded] Successfully Processed Event`,
                data: tags,
              })
            } catch (err) {
              console.log(
                `[STRIPE WEBHOOK][TIME: ${time}][EVENT: setup_intent.succeeded] An error occured creating payment intent for stripeCustomer (${stripeCustomerId}) and setup intent: ${sEId}`
              )
              console.log(
                JSON.stringify({
                  setupIntentId: dataObject.id,
                  stripeCustomerId,
                  ignoreCheckout,
                  ...(!ignoreCheckout &&
                    sECheckout && { checkoutId: sECheckout._id }),
                })
              )
              console.log(err)
              Sentry.captureException(err, {
                tags: {
                  setupIntentId: dataObject.id,
                  stripeCustomerId,
                  ignoreCheckout,
                  ...(!ignoreCheckout &&
                    sECheckout && { checkoutId: sECheckout._id }),
                },
              })
              return res.status(500).send({
                code: 500,
                message: `An error occured creating payment intent for stripeCustomer (${stripeCustomerId}) and setupIntent: ${dataObject.id}`,
                data: {
                  setupIntentId: dataObject.id,
                  stripeCustomerId,
                  ignoreCheckout,
                  ...(!ignoreCheckout &&
                    sECheckout && { checkoutId: sECheckout._id }),
                },
                error: JSON.stringify(err),
              })
            }
          } else {
            try {
              const stripeSubscription = await Stripe.subscriptions.create({
                customer: stripeCustomerId,
                items: [{ price: stripeSubscriptonPriceId }],
                default_payment_method: paymentMethodId,
                collection_method: "charge_automatically",
                metadata: {
                  CREATED_VIA_STRIPE_WEBHOOK_ON: new Date().toString(),
                  ...(!ignoreCheckout &&
                    sEId && { ORIGINAL_CHECKOUT_ID: sEId._id }),
                },
              })

              const tags = {
                setupIntentId: dataObject.id,
                stripeCustomerId,
                stripeSubscriptionId: stripeSubscription.id,
                ignoreCheckout,
                ...(!ignoreCheckout &&
                  sECheckout && { checkoutId: sECheckout._id }),
              }

              if (!ignoreCheckout && sECheckout) {
                sECheckout.stripeSubscriptionId = stripeSubscription.id
                await sECheckout.save()
                console.log(
                  `[STRIPE WEBHOOK][TIME: ${time}][EVENT: setup_intent.succeeded] Successfully Saved "stripeSubscriptionId" on checkout: ${sECheckout._id}`
                )
                Sentry.captureMessage(
                  `[STRIPE WEBHOOK][TIME: ${time}][EVENT: setup_intent.succeeded] Successfully Saved "stripeSubscriptionId" on checkout: ${sECheckout._id}`,
                  {
                    tags,
                  }
                )
              }

              console.log(
                `[STRIPE WEBHOOK][TIME: ${time}][EVENT: setup_intent.succeeded] Successfully Processed Event`
              )
              console.log(JSON.stringify(tags))
              Sentry.captureMessage(
                `[STRIPE WEBHOOK][TIME: ${time}][EVENT: setup_intent.succeeded] Successfully Processed Event`,
                {
                  tags,
                }
              )
              return res.status(200).send({
                code: 200,
                message: `[STRIPE WEBHOOK][TIME: ${time}][EVENT: setup_intent.succeeded] Successfully Processed Event`,
                data: tags,
              })
            } catch (err) {
              console.log(
                `[STRIPE WEBHOOK][TIME: ${time}][EVENT: setup_intent.succeeded] An error occured creating subscription for stripeCustomer (${stripeCustomerId}) and setup intent: ${sEId}`
              )
              console.log(
                JSON.stringify({
                  setupIntentId: dataObject.id,
                  stripeCustomerId,
                  ignoreCheckout,
                  ...(!ignoreCheckout &&
                    sECheckout && { checkoutId: sECheckout._id }),
                })
              )
              console.log(err)
              Sentry.captureException(err, {
                tags: {
                  setupIntentId: dataObject.id,
                  stripeCustomerId,
                  ignoreCheckout,
                  ...(!ignoreCheckout &&
                    sECheckout && { checkoutId: sECheckout._id }),
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
                    sECheckout && { checkoutId: sECheckout._id }),
                },
                error: JSON.stringify(err),
              })
            }
          }
        case "payment_intent.succeeded":
          const pIId = dataObject.id
          const pICId = dataObject.customer

          if (!dataObject.metadata?.CREATED_VIA_STRIPE_WEBHOOK_ON) {
            console.log(
              `[STRIPE WEBHOOK][TIME: ${time}][EVENT: payment_intent.succeeded] Not created by webhook, skipping... - ${pIId}`
            )
            console.log(
              JSON.stringify({
                stripePaymentIntentId: pIId,
                stripeCustomerId: pICId,
              })
            )
            return res.status(200).send({
              code: 200,
              message: `[STRIPE WEBHOOK][TIME: ${time}][EVENT: payment_intent.succeeded] Not created by webhook, skipping... - ${pIId}`,
              data: {
                stripePaymentIntentId: pIId,
                stripeCustomerId: pICId,
              },
            })
          }

          if (!pICId) {
            console.log(
              `[STRIPE WEBHOOK][TIME: ${time}][EVENT: payment_intent.succeeded] No stripe customer id present on payment intent id: ${pIId}`
            )
            console.log(
              JSON.stringify({
                stripePaymentIntentId: pIId,
                stripeCustomerId: pICId,
              })
            )
            Sentry.captureException(
              `[STRIPE WEBHOOK][TIME: ${time}][EVENT: payment_intent.succeeded] No stripe customer id present on payment intent id: ${pIId}`,
              {
                tags: {
                  stripePaymentIntentId: pIId,
                  stripeCustomerId: pICId,
                },
              }
            )
            return res.status(400).send({
              code: 400,
              message: `[STRIPE WEBHOOK][TIME: ${time}][EVENT: payment_intent.succeeded] No stripe customer id present on payment intent id: ${pIId}`,
              data: {
                stripePaymentIntentId: pIId,
                stripeCustomerId: pICId,
              },
            })
          }

          try {
            const pIExistingUser = await UserModel.findOne({
              $or: [
                { stripeCustomerId: pICId },
                { stripePaymentIntentId: pIId },
              ],
            })

            if (pIExistingUser) {
              pIExistingUser.stripePaymentIntentId = pIId
              pIExistingUser.subscriptionExpiresAt = null
              await pIExistingUser.save()

              await Stripe.paymentIntents.update(pICId, {
                metadata: {
                  USER_ID: pIExistingUser._id,
                  UPDATED_VIA_STRIPE_WEBHOOK_ON: new Date().toString(),
                },
              })

              await Stripe.customers.update(pICId, {
                metadata: {
                  USER_ID: pIExistingUser._id,
                  UPDATED_VIA_STRIPE_WEBHOOK_ON: new Date().toString(),
                },
              })

              console.log(
                `[STRIPE WEBHOOK][TIME: ${time}][EVENT: payment_intent.succeeded] Successfully Updated User (${pIExistingUser._id}) with stripe payment intent id: ${pIId}`
              )
              console.log(
                JSON.stringify({
                  stripePaymentIntentId: pIId,
                  stripeCustomerId: pICId,
                })
              )
              Sentry.captureMessage(
                `[STRIPE WEBHOOK][TIME: ${time}][EVENT: payment_intent.succeeded] Successfully Updated User (${pIExistingUser._id}) with stripe payment intent id: ${pIId}`,
                {
                  tags: {
                    stripePaymentIntentId: pIId,
                    stripeCustomerId: pICId,
                    existingUserId: pIExistingUser._id,
                  },
                }
              )
              return res.status(200).send({
                code: 200,
                message: `[STRIPE WEBHOOK][TIME: ${time}][EVENT: payment_intent.succeeded] Successfully Updated User (${pIExistingUser._id}) with stripe subscription id: ${pIId}`,
                data: {
                  stripePaymentIntentId: pIId,
                  stripeCustomerId: pICId,
                  existingUserId: pIExistingUser._id,
                },
              })
            } else {
              // NO USER FOUND, CHECK CHECKOUTS
              console.log(
                `[STRIPE WEBHOOK][TIME: ${time}][EVENT: payment_intent.succeeded] No existing user found for stripe payment intent id (${pIId}). Checking checkouts...`
              )
              console.log(
                JSON.stringify({
                  stripePaymentIntentId: pIId,
                  stripeCustomerId: pICId,
                })
              )
            }
          } catch (err) {
            console.log(
              `[STRIPE WEBHOOK][TIME: ${time}][EVENT: payment_intent.succeeded] An error occured updating existing user with stripe payment intent id: ${pIId}`
            )
            console.log(
              JSON.stringify({
                stripePaymentIntentId: pIId,
                stripeCustomerId: pICId,
              })
            )
            console.log(err)
            Sentry.captureException(err, {
              tags: {
                stripePaymentIntentId: pIId,
                stripeCustomerId: pICId,
              },
            })
            return res.status(500).send({
              code: 500,
              message: `[STRIPE WEBHOOK][TIME: ${time}][EVENT: payment_intent.succeeded] An error occured updating existing user with stripe payment intent id: ${pIId}`,
              data: {
                stripePaymentIntentId: pIId,
                stripeCustomerId: pICId,
              },
            })
          }

          // create new user
          try {
            const pICheckout = await CheckoutModel.findOne({
              stripeCustomerId: pICId,
            })

            if (!pICheckout) {
              throw new Error(
                `Checkout not found for stripe customer id: ${pICId}`
              )
            }

            try {
              const newUser = await userService.createUser({
                name: pICheckout.name,
                textOptIn: pICheckout.textOptIn,
                email: pICheckout.email,
                phone: pICheckout.phone,
                dateOfBirth: pICheckout.dateOfBirth,
                address: pICheckout.shippingAddress,
                weightInLbs: pICheckout.weightInLbs,
                gender: pICheckout.gender,
                heightInInches: pICheckout.heightInInches,
                stripeCustomerId: pICId,
                stripePaymentIntentId: pIId,
                stripeSubscriptionId: null,
              })

              await Stripe.paymentIntents.update(pICId, {
                metadata: {
                  USER_ID: newUser.user._id,
                  UPDATED_VIA_STRIPE_WEBHOOK_ON: new Date().toString(),
                },
              })
              await Stripe.customers.update(pICId, {
                metadata: {
                  USER_ID: newUser.user._id,
                  UPDATED_VIA_STRIPE_WEBHOOK_ON: new Date().toString(),
                },
              })

              console.log(
                `[STRIPE WEBHOOK][TIME: ${time}][EVENT: payment_intent.succeeded] Successfully Created User (${newUser.user._id}) from Checkout with stripe payment intent id: ${pIId}`
              )
              console.log(
                JSON.stringify({
                  stripePaymentIntentId: pIId,
                  stripeCustomerId: pICId,
                  newUserId: newUser.user._id,
                  checkoutId: pICheckout._id,
                })
              )
              Sentry.captureMessage(
                `[STRIPE WEBHOOK][TIME: ${time}][EVENT: payment_intent.succeeded] Successfully Updated User (${newUser.user._id}) with stripe payment intent id: ${pIId}`,
                {
                  tags: {
                    stripePaymentIntentId: pIId,
                    stripeCustomerId: pICId,
                    newUserId: newUser.user._id,
                    checkoutId: pICheckout._id,
                  },
                }
              )
              return res.status(201).send({
                code: 201,
                message: `[STRIPE WEBHOOK][TIME: ${time}][EVENT: payment_intent.succeeded] Successfully Updated User (${newUser.user._id}) with stripe payment intent id: ${pIId}`,
                data: {
                  stripePaymentIntentId: pIId,
                  stripeCustomerId: pICId,
                  newUserId: newUser.user._id,
                  checkoutId: pICheckout._id,
                },
              })
            } catch (err) {
              // error occured creating new user
              console.log(
                `[STRIPE WEBHOOK][TIME: ${time}][EVENT: payment_intent.succeeded] Error creating user for stripe customer id: ${pICId}`
              )
              console.log(
                JSON.stringify({
                  stripePaymentIntentId: pIId,
                  stripeCustomerId: pICId,
                })
              )
              console.log(err)
              Sentry.captureException(
                `[STRIPE WEBHOOK][TIME: ${time}][EVENT: payment_intent.succeeded] Error creating user for stripe customer id: ${pICId} ${err}`,
                {
                  tags: {
                    stripePaymentIntentId: pIId,
                    stripeCustomerId: pICId,
                  },
                }
              )
              return res.status(500).send({
                code: 500,
                message: `Error creating user for stripe customer id: ${pICId}`,
                data: {
                  stripePaymentIntentId: pIId,
                  stripeCustomerId: pICId,
                },
              })
            }
          } catch (err) {
            console.log(
              `[STRIPE WEBHOOK][TIME: ${time}][EVENT: payment_intent.succeeded] Checkout not found for stripe customer id: ${pICId}`
            )
            console.log(
              JSON.stringify({
                stripePaymentIntentId: pIId,
                stripeCustomerId: pICId,
              })
            )
            console.log(err)
            Sentry.captureException(
              `[STRIPE WEBHOOK][TIME: ${time}][EVENT: payment_intent.succeeded] Checkout not found for stripe customer id: ${pICId}`,
              {
                tags: {
                  stripePaymentIntentId: pIId,
                  stripeCustomerId: pICId,
                },
              }
            )
            return res.status(404).send({
              code: 404,
              message: `Checkout not found for stripe customer id: ${pICId}`,
              data: {
                stripePaymentIntentId: pIId,
                stripeCustomerId: pICId,
              },
            })
          }

        // subscription created
        case "customer.subscription.created":
          const sCId = dataObject.id
          const sCCId = dataObject.customer

          if (!sCCId) {
            console.log(
              `[STRIPE WEBHOOK][TIME: ${time}][EVENT: customer.subscription.created] No stripe customer id present on subscription id: ${sCId}`
            )
            console.log(
              JSON.stringify({
                stripeSubscriptionId: sCId,
                stripeCustomerId: sCCId,
              })
            )
            Sentry.captureException(
              `[STRIPE WEBHOOK][TIME: ${time}][EVENT: customer.subscription.created] No stripe customer id present on subscription id: ${sCId}`,
              {
                tags: {
                  stripeSubscriptionId: sCId,
                  stripeCustomerId: sCCId,
                },
              }
            )
            return res.status(400).send({
              code: 400,
              message: `[STRIPE WEBHOOK][TIME: ${time}][EVENT: customer.subscription.created] No stripe customer id present on subscription id: ${sCId}`,
              data: {
                stripeSubscriptionId: sCId,
                stripeCustomerId: sCCId,
              },
            })
          }

          try {
            const sCExistingUser = await UserModel.findOne({
              $or: [
                { stripeCustomerId: sCCId },
                { stripeSubscriptionId: sCId },
              ],
            })

            if (sCExistingUser) {
              sCExistingUser.stripeSubscriptionId = sCId
              sCExistingUser.subscriptionExpiresAt = new Date(
                dataObject.current_period_end * 1000
              )
              await sCExistingUser.save()

              await Stripe.subscriptions.update(sCId, {
                metadata: {
                  USER_ID: sCExistingUser._id,
                  UPDATED_VIA_STRIPE_WEBHOOK_ON: new Date().toString(),
                },
              })

              await Stripe.customers.update(sCCId, {
                metadata: {
                  USER_ID: sCExistingUser._id,
                  UPDATED_VIA_STRIPE_WEBHOOK_ON: new Date().toString(),
                },
              })

              console.log(
                `[STRIPE WEBHOOK][TIME: ${time}][EVENT: customer.subscription.created] Successfully Updated User (${sCExistingUser._id}) with stripe subscription id: ${sCId}`
              )
              console.log(
                JSON.stringify({
                  stripeSubscriptionId: sCId,
                  stripeCustomerId: sCCId,
                })
              )
              Sentry.captureMessage(
                `[STRIPE WEBHOOK][TIME: ${time}][EVENT: customer.subscription.created] Successfully Updated User (${sCExistingUser._id}) with stripe subscription id: ${sCId}`,
                {
                  tags: {
                    stripeSubscriptionId: sCId,
                    stripeCustomerId: sCCId,
                    existingUserId: sCExistingUser._id,
                  },
                }
              )
              return res.status(200).send({
                code: 200,
                message: `[STRIPE WEBHOOK][TIME: ${time}][EVENT: customer.subscription.created] Successfully Updated User (${sCExistingUser._id}) with stripe subscription id: ${sCId}`,
                data: {
                  stripeSubscriptionId: sCId,
                  stripeCustomerId: sCCId,
                  existingUserId: sCExistingUser._id,
                },
              })
            } else {
              // NO USER FOUND, CHECK CHECKOUTS
              console.log(
                `[STRIPE WEBHOOK][TIME: ${time}][EVENT: customer.subscription.created] No existing user found for stripe subscription id (${sCId}). Checking checkouts...`
              )
              console.log(
                JSON.stringify({
                  stripeSubscriptionId: sCId,
                  stripeCustomerId: sCCId,
                })
              )
            }
          } catch (err) {
            console.log(
              `[STRIPE WEBHOOK][TIME: ${time}][EVENT: customer.subscription.created] An error occured updating existing user with stripe subscription id: ${dataObject.id}`
            )
            console.log(
              JSON.stringify({
                stripeSubscriptionId: sCId,
                stripeCustomerId: sCCId,
              })
            )
            console.log(err)
            Sentry.captureException(err, {
              tags: {
                stripeSubscriptionId: sCId,
                stripeCustomerId: sCCId,
              },
            })
            return res.status(500).send({
              code: 500,
              message: `[STRIPE WEBHOOK][TIME: ${time}][EVENT: customer.subscription.created] An error occured updating existing user with stripe subscription id: ${dataObject.id}`,
              data: {
                stripeSubscriptionId: sCId,
                stripeCustomerId: sCCId,
              },
            })
          }

          // create new user
          try {
            const sCCheckout = await CheckoutModel.findOne({
              stripeCustomerId: sCCId,
            })

            if (!sCCheckout) {
              throw new Error(
                `Checkout not found for stripe customer id: ${sCCId}`
              )
            }

            try {
              const newUser = await userService.createUser({
                name: sCCheckout.name,
                textOptIn: sCCheckout.textOptIn,
                email: sCCheckout.email,
                phone: sCCheckout.phone,
                dateOfBirth: sCCheckout.dateOfBirth,
                address: sCCheckout.shippingAddress,
                weightInLbs: sCCheckout.weightInLbs,
                gender: sCCheckout.gender,
                heightInInches: sCCheckout.heightInInches,
                stripeCustomerId: sCCId,
                stripeSubscriptionId: sCId,
                subscriptionExpiresAt: new Date(),
                insurancePlan: sCCheckout.insurancePlan,
                insuranceType: sCCheckout.insuranceType,
                signupPartner: sCCheckout.signupPartner,
              })

              await Stripe.subscriptions.update(sCId, {
                metadata: {
                  USER_ID: newUser.user._id,
                  UPDATED_VIA_STRIPE_WEBHOOK_ON: new Date().toString(),
                },
              })
              await Stripe.customers.update(sCCId, {
                metadata: {
                  USER_ID: newUser.user._id,
                  UPDATED_VIA_STRIPE_WEBHOOK_ON: new Date().toString(),
                },
              })

              console.log(
                `[STRIPE WEBHOOK][TIME: ${time}][EVENT: customer.subscription.created] Successfully Created User (${newUser.user._id}) from Checkout with stripe subscription id: ${sCId}`
              )
              console.log(
                JSON.stringify({
                  stripeSubscriptionId: sCId,
                  stripeCustomerId: sCCId,
                  newUserId: newUser.user._id,
                  checkoutId: sCCheckout._id,
                })
              )
              Sentry.captureMessage(
                `[STRIPE WEBHOOK][TIME: ${time}][EVENT: customer.subscription.created] Successfully Updated User (${newUser.user._id}) with stripe subscription id: ${sCId}`,
                {
                  tags: {
                    stripeSubscriptionId: sCId,
                    stripeCustomerId: sCCId,
                    newUserId: newUser.user._id,
                    checkoutId: sCCheckout._id,
                  },
                }
              )
              return res.status(201).send({
                code: 201,
                message: `[STRIPE WEBHOOK][TIME: ${time}][EVENT: customer.subscription.created] Successfully Updated User (${newUser.user._id}) with stripe subscription id: ${sCId}`,
                data: {
                  stripeSubscriptionId: sCId,
                  stripeCustomerId: sCCId,
                  newUserId: newUser.user._id,
                  checkoutId: sCCheckout._id,
                },
              })
            } catch (err) {
              // error occured creating new user
              console.log(
                `[STRIPE WEBHOOK][TIME: ${time}][EVENT: customer.subscription.created] Error creating user for stripe customer id: ${sCCId}`
              )
              console.log(
                JSON.stringify({
                  stripeSubscriptionId: sCId,
                  stripeCustomerId: sCCId,
                })
              )
              console.log(err)
              Sentry.captureException(
                `[STRIPE WEBHOOK][TIME: ${time}][EVENT: customer.subscription.created] Error creating user for stripe customer id: ${sCCId} ${err}`,
                {
                  tags: {
                    stripeSubscriptionId: sCId,
                    stripeCustomerId: sCCId,
                  },
                }
              )
              return res.status(500).send({
                code: 500,
                message: `Error creating user for stripe customer id: ${sCCId}`,
                data: {
                  stripeSubscriptionId: sCId,
                  stripeCustomerId: sCCId,
                },
              })
            }
          } catch (err) {
            console.log(
              `[STRIPE WEBHOOK][TIME: ${time}][EVENT: customer.subscription.created] Checkout not found for stripe customer id: ${sCCId}`
            )
            console.log(
              JSON.stringify({
                stripeSubscriptionId: sCId,
                stripeCustomerId: sCCId,
              })
            )
            console.log(err)
            Sentry.captureException(
              `[STRIPE WEBHOOK][TIME: ${time}][EVENT: customer.subscription.created] Checkout not found for stripe customer id: ${sCCId}`,
              {
                tags: {
                  stripeSubscriptionId: sCId,
                  stripeCustomerId: sCCId,
                },
              }
            )
            return res.status(404).send({
              code: 404,
              message: `Checkout not found for stripe customer id: ${sCCId}`,
              data: {
                stripeSubscriptionId: sCId,
                stripeCustomerId: sCCId,
              },
            })
          }

        case "customer.subscription.updated":
          const sCUId = dataObject.id
          const sCUCId = dataObject.customer
          const sCUPeriodEnd = new Date(
            (dataObject.ended_at
              ? dataObject.ended_at
              : dataObject.current_period_end) * 1000
          )

          try {
            const sCUExistingUser = await UserModel.findOne({
              $or: [
                { stripeSubscriptionId: sCUCId },
                { stripeCustomerId: sCUCId },
              ],
            })

            if (!sCUExistingUser) {
              throw Error(
                `User not found for stripe customer id (${sCUCId}) or subscription id: ${sCUId}`
              )
            }

            // update subscriptionExpiresAt
            sCUExistingUser.subscriptionExpiresAt = sCUPeriodEnd
            await sCUExistingUser.save()

            console.log(
              `[STRIPE WEBHOOK][TIME: ${time}][EVENT: ${event.type}] Successfully subscription expiration date for user: ${sCUExistingUser._id}`
            )
            console.log(
              JSON.stringify({
                stripeSubscriptionId: sCUCId,
                stripeCustomerId: sCUCId,
                userId: sCUExistingUser._id,
                subscriptionExpiresAt: sCUPeriodEnd.toString(),
              })
            )
            Sentry.captureMessage(
              `[STRIPE WEBHOOK][TIME: ${time}][EVENT: ${event.type}] Successfully updated subscription expiration date for user: ${sCUExistingUser._id}`,
              {
                tags: {
                  stripeSubscriptionId: sCUCId,
                  stripeCustomerId: sCUCId,
                  userId: sCUExistingUser._id,
                  subscriptionExpiresAt: sCUPeriodEnd.toString(),
                },
              }
            )
            return res.status(200).send({
              code: 200,
              message: `Subscription expiration date updated for user: ${sCUExistingUser._id}`,
              data: {
                stripeSubscriptionId: sCUCId,
                stripeCustomerId: sCUCId,
                userId: sCUExistingUser._id,
                subscriptionExpiresAt: sCUPeriodEnd.toString(),
              },
            })
          } catch (err) {
            console.log(
              `[STRIPE WEBHOOK][TIME: ${time}][EVENT: ${event.type}] User not found for stripe customer id (${sCUCId}) or subscription id: ${sCUId}`
            )
            console.log(
              JSON.stringify({
                stripeSubscriptionId: sCUCId,
                stripeCustomerId: sCUCId,
              })
            )
            console.log(err)
            Sentry.captureException(
              `[STRIPE WEBHOOK][TIME: ${time}][EVENT: ${event.type}] User not found for stripe customer id (${sCUCId}) or subscription id: ${sCUId}`,
              {
                tags: {
                  stripeSubscriptionId: sCUCId,
                  stripeCustomerId: sCUCId,
                },
              }
            )
            return res.status(404).send({
              code: 404,
              message: `User not found for stripe customer id (${sCUCId}) or subscription id: ${sCUId}`,
              data: {
                stripeSubscriptionId: sCUCId,
                stripeCustomerId: sCUCId,
              },
            })
          }

        default:
          Sentry.captureException(
            `[STRIPE WEBHOOK][TIME: ${time}][EVENT: ${event.type}] Not handled by webhook`
          )
          return res.status(404).send({
            code: 404,
            message: `Event ${event.type} not handled by webhook`,
          })
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

  app.post("/metriportWebhooks", express.json(), async (req, res) => {
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

      const date = new Date()

      await Promise.all(
        users.map(async (metriportUser: MetriportUser) => {
          const { userId, body } = metriportUser
          if (body?.[0]?.weight_kg) {
            const weightLbs = Math.floor(body[0].weight_kg * 2.2)
            await userService.processWithingsScaleReading(userId, weightLbs)
          }
        })
      )

      return res.status(200).send({ message: "Webhook processed successfully" })
    } catch (err) {
      console.log(err)
      Sentry.captureException(err)
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
  console.log(`[TASK JOB][${new Date().toString()}] RUNNING...`)
  await userService.taskJob()
  console.log(`[TASK JOB][${new Date().toString()}] COMPLETED`)
})

// run appointment attendance job
cron.schedule("*/30 * * * *", async () => {
  console.log(`[APPOINTMENT ATTENDED JOB][${new Date().toString()}] RUNNING...`)
  await appointmentService.postAppointmentJob()
  console.log(`[APPOINTMENT ATTENDED JOB][${new Date().toString()}] COMPLETED`)
})

bootstrap()

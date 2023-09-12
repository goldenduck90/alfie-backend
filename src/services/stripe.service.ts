import Stripe from "stripe"
import * as express from "express"
import config from "config"
import { captureEvent, captureException } from "../utils/sentry"
import postHogClient from "../utils/posthog"
import { Checkout, CheckoutModel } from "../schema/checkout.schema"
import { Address, UserModel } from "../schema/user.schema"
import UserService from "./user.service"
import { SignupPartner } from "../schema/partner.schema"

export default class StripeService {
  public stripeApiVersion = "2022-08-01" as const
  public stripeWebhookPath = "/stripeWebhooks"

  public stripeSdk: Stripe
  private secretKey: string
  private webhookKey: string

  private userService: UserService

  // price IDs
  public defaultPriceId: string
  public partnerPriceId: string

  constructor(userService?: UserService) {
    this.secretKey = config.get("stripe.secretKey")
    this.webhookKey = config.get("stripe.webhookSecret")
    this.stripeSdk = new Stripe(this.secretKey, {
      apiVersion: this.stripeApiVersion,
    })
    this.defaultPriceId = config.get("stripe.defaultPriceId")
    this.partnerPriceId = config.get("stripe.partnerPriceId")

    this.userService = userService ?? new UserService()
  }

  constructWebhookEventFromRequest(request: express.Request): Stripe.Event {
    const { body } = request
    const stripeSignature = request.headers["stripe-signature"]

    return this.constructWebhookEvent(body, stripeSignature)
  }

  constructWebhookEvent(
    body: string | Buffer,
    stripeSignature: string | string[]
  ): Stripe.Event {
    try {
      const event = this.stripeSdk.webhooks.constructEvent(
        body,
        stripeSignature,
        this.webhookKey
      )

      return event
    } catch (err) {
      captureException(err, "Stripe Webhook: Error decoding event", {
        body,
        stripeSignature,
      })
      throw new Error(`Error decoding event: ${err.message}`)
    }
  }

  initializeWebhook(app: express.Application) {
    const handler = async (req: express.Request, res: express.Response) => {
      let event: Stripe.Event
      try {
        event = this.constructWebhookEventFromRequest(req)
      } catch (err) {
        return this.sendErrorResponse(res, err.message, {})
      }

      const dataObject = event.data.object as any

      switch (event.type) {
        case "setup_intent.succeeded":
          return await this.handleSetupIntentSucceeded(res, dataObject)
        case "payment_intent.succeeded":
          return await this.handlePaymentIntentSucceeded(res, dataObject)
        case "customer.subscription.created":
          return await this.handleSubscriptionCreated(res, dataObject)
        case "customer.subscription.updated":
          return await this.handleSubscriptionUpdated(res, dataObject)
        default:
          return this.sendErrorResponse(
            res,
            `Event ${event.type} not handled by webhook.`,
            { dataObject, event: event.type }
          )
      }
    }

    app.post(
      this.stripeWebhookPath,
      express.raw({ type: "application/json" }),
      handler
    )
  }

  async handleSubscriptionUpdated(
    res: express.Response,
    subscription: Stripe.Subscription
  ) {
    const subscriptionId = subscription.id
    const customerId =
      typeof subscription.customer === "object"
        ? subscription.customer?.id
        : subscription.customer
    const subscriptionPeriodEnd = new Date(
      (subscription.ended_at ?? subscription.current_period_end) * 1000
    )

    try {
      const user = await UserModel.findOne({
        $or: [
          { stripeSubscriptionId: subscriptionId },
          { stripeCustomerId: customerId },
        ],
      })

      if (!user) {
        return this.sendErrorResponse(
          res,
          `User not found for stripe customer id (${customerId}) or subscription id: ${subscriptionId}`,
          {
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
          },
          null,
          404
        )
      }

      // update subscriptionExpiresAt
      user.subscriptionExpiresAt = subscriptionPeriodEnd
      await user.save()

      return this.sendSuccessResponse(
        res,
        `Stripe Webhook: customer.subscription.updated: Successfully subscription expiration date for user: ${user._id}`,
        {
          stripeSubscriptionId: subscriptionId,
          stripeCustomerId: customerId,
          userId: user._id,
          subscriptionExpiresAt: subscriptionPeriodEnd.toString(),
        }
      )
    } catch (err) {
      return this.sendErrorResponse(
        res,
        `Stripe Webhook: customer.subscription.updated: Error updating user from subscription ${subscriptionId}`,
        {
          stripeSubscriptionId: subscriptionId,
          stripeCustomerId: customerId,
        },
        err,
        500
      )
    }
  }

  async handleSubscriptionCreated(
    res: express.Response,
    subscription: Stripe.Subscription
  ) {
    const subscriptionId = subscription.id
    const customerId =
      typeof subscription.customer === "object"
        ? subscription.customer?.id
        : subscription.customer

    if (!customerId) {
      return this.sendErrorResponse(
        res,
        `Stripe Webhook: customer.subscription.created: No stripe customer id present on subscription id: ${subscriptionId}`,
        {
          stripeSubscriptionId: subscriptionId,
          stripeCustomerId: customerId,
        }
      )
    }

    try {
      const user = await UserModel.findOne({
        $or: [
          { stripeCustomerId: customerId },
          { stripeSubscriptionId: subscriptionId },
        ],
      })

      if (user) {
        user.stripeSubscriptionId = subscriptionId
        user.subscriptionExpiresAt = new Date(
          subscription.current_period_end * 1000
        )
        await user.save()

        await this.stripeSdk.subscriptions.update(subscriptionId, {
          metadata: {
            USER_ID: user._id,
            UPDATED_VIA_STRIPE_WEBHOOK_ON: new Date().toString(),
          },
        })

        await this.stripeSdk.customers.update(customerId, {
          metadata: {
            USER_ID: user._id,
            UPDATED_VIA_STRIPE_WEBHOOK_ON: new Date().toString(),
          },
        })

        return this.sendSuccessResponse(
          res,
          `Stripe Webhook: customer.subscription.created: Successfully Updated User (${user._id}) with stripe subscription id: ${subscriptionId}`,
          {
            stripeSubscriptionId: subscriptionId,
            stripeCustomerId: customerId,
            exitingUserId: user._id,
          }
        )
      }
    } catch (err) {
      return this.sendErrorResponse(
        res,
        `Stripe Webhook: customer.subscription.created: An error occured updating existing user with stripe subscription id: ${subscription.id}`,
        {
          stripeSubscriptionId: subscriptionId,
          stripeCustomerId: customerId,
        },
        err
      )
    }

    // No user found, check checkouts
    captureEvent(
      "info",
      `Stripe Webhook: customer.subscription.created] No existing user found for stripe subscription id (${subscriptionId}). Checking checkouts...`,
      {
        stripeSubscriptionId: subscriptionId,
        stripeCustomerId: customerId,
      }
    )

    // Create new user
    try {
      const checkout = await CheckoutModel.findOne({
        stripeCustomerId: customerId,
      })

      if (!checkout) {
        return this.sendErrorResponse(
          res,
          `Checkout not found for stripe customer id: ${customerId}`,
          { stripeCustomerId: customerId, stripeSubscriptionId: subscriptionId }
        )
      }

      const newUser = await this.userService.createUser({
        name: checkout.name,
        textOptIn: checkout.textOptIn,
        email: checkout.email,
        phone: checkout.phone,
        dateOfBirth: checkout.dateOfBirth,
        address: checkout.shippingAddress,
        weightInLbs: checkout.weightInLbs,
        gender: checkout.gender,
        heightInInches: checkout.heightInInches,
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
        subscriptionExpiresAt: new Date(),
        insurance: checkout.insurance,
        insurancePlan: checkout.insurancePlan,
        insuranceType: checkout.insuranceType,
        insuranceCovered: checkout.insuranceCovered,
        signupPartnerId: checkout.signupPartner?.toString(),
        signupPartnerProviderId: checkout.signupPartnerProvider?.toString(),
      })

      if (process.env.NODE_ENV === "production") {
        postHogClient.capture({
          distinctId: checkout._id,
          event: "Checkout Complete",
          properties: {
            referrer: checkout.referrer || "None",
            checkoutId: checkout._id,
            userId: newUser.user._id,
            signupPartner: checkout.signupPartner || "None",
            signupPartnerProvider: checkout.signupPartnerProvider || "None",
            insurancePay: checkout.insurancePlan ? true : false,
            environment: process.env.NODE_ENV,
          },
        })
      }

      await this.stripeSdk.subscriptions.update(subscriptionId, {
        metadata: {
          USER_ID: newUser.user._id,
          UPDATED_VIA_STRIPE_WEBHOOK_ON: new Date().toString(),
        },
      })
      await this.stripeSdk.customers.update(customerId, {
        metadata: {
          USER_ID: newUser.user._id,
          UPDATED_VIA_STRIPE_WEBHOOK_ON: new Date().toString(),
        },
      })

      checkout.user = newUser.user._id
      checkout.checkedOut = true
      await checkout.save()

      return this.sendSuccessResponse(
        res,
        `Stripe Webhook: customer.subscription.created: Successfully Created User (${newUser.user._id}) from Checkout with stripe subscription id: ${subscriptionId}`,
        {
          stripeSubscriptionId: subscriptionId,
          stripeCustomerId: customerId,
          newUserId: newUser.user._id,
          checkoutId: checkout._id,
        },
        201
      )
    } catch (err) {
      return this.sendErrorResponse(
        res,
        `Stripe Webhook: customer.subscription.created: Error creating user for stripe customer id: ${customerId}`,
        {
          stripeSubscriptionId: subscriptionId,
          stripeCustomerId: customerId,
        },
        err
      )
    }
  }

  async handlePaymentIntentSucceeded(
    res: express.Response,
    paymentIntent: Stripe.PaymentIntent
  ) {
    const paymentIntentId = paymentIntent.id
    const customerId: string =
      typeof paymentIntent.customer === "object"
        ? paymentIntent.customer?.id
        : paymentIntent.customer

    if (!paymentIntent.metadata?.CREATED_VIA_STRIPE_WEBHOOK_ON) {
      return this.sendSuccessResponse(
        res,
        `Payment intent not created by stripe webhook, skipping: ${paymentIntentId}`,
        {
          stripePaymentIntentId: paymentIntentId,
          stripeCustomerId: customerId,
        }
      )
    }

    if (!customerId) {
      return this.sendErrorResponse(
        res,
        `No stripe customer id present on payment intent id: ${paymentIntentId}`,
        { stripePaymentIntentId: paymentIntentId, stripeCustomerId: customerId }
      )
    }

    try {
      const user = await UserModel.findOne({
        $or: [
          { stripeCustomerId: customerId },
          { stripePaymentIntentId: paymentIntentId },
        ],
      })

      if (user) {
        user.stripePaymentIntentId = paymentIntentId
        user.subscriptionExpiresAt = new Date()
        await user.save()

        await this.stripeSdk.paymentIntents.update(paymentIntentId, {
          metadata: {
            USER_ID: user._id,
            UPDATED_VIA_STRIPE_WEBHOOK_ON: new Date().toString(),
          },
        })

        await this.stripeSdk.customers.update(customerId, {
          metadata: {
            USER_ID: user._id,
            UPDATED_VIA_STRIPE_WEBHOOK_ON: new Date().toString(),
          },
        })

        return this.sendSuccessResponse(
          res,
          `Successfully Updated User (${user._id}) with stripe payment intent id: ${paymentIntentId}`,
          {
            stripePaymentIntentId: paymentIntentId,
            stripeCustomerId: customerId,
            existingUserId: user._id,
          }
        )
      }
    } catch (err) {
      return this.sendErrorResponse(
        res,
        `Stripe Webhook: payment_intent.succeeded: An error occured updating existing user with stripe payment intent id: ${paymentIntentId}`,
        {
          stripePaymentIntentId: paymentIntentId,
          stripeCustomerId: customerId,
        }
      )
    }

    // No user found, check checkouts
    captureEvent(
      "info",
      `Stripe payment_intent.succeeded webhook: No existing user found for stripe payment intent id (${paymentIntentId}). Checking checkouts.`,
      {
        stripePaymentIntentId: paymentIntentId,
        stripeCustomerId: customerId,
      }
    )

    // create new user
    try {
      const checkout = await CheckoutModel.findOne({
        stripeCustomerId: customerId,
      })

      if (!checkout) {
        return this.sendErrorResponse(
          res,
          `Stripe Webhook: payment_intent.succeeded: Checkout not found for stripe customer id: ${customerId}`,
          {
            stripePaymentIntentId: paymentIntentId,
            stripeCustomerId: customerId,
          }
        )
      }

      const { user: newUser } = await this.userService.createUser({
        name: checkout.name,
        textOptIn: checkout.textOptIn,
        email: checkout.email,
        phone: checkout.phone,
        dateOfBirth: checkout.dateOfBirth,
        address: checkout.shippingAddress,
        weightInLbs: checkout.weightInLbs,
        gender: checkout.gender,
        heightInInches: checkout.heightInInches,
        stripeCustomerId: customerId,
        stripePaymentIntentId: paymentIntentId,
        stripeSubscriptionId: null,
        insurance: checkout.insurance,
        insurancePlan: checkout.insurancePlan,
        insuranceType: checkout.insuranceType,
        insuranceCovered: checkout.insuranceCovered,
        signupPartnerId: checkout.signupPartner?.toString(),
        signupPartnerProviderId: checkout.signupPartnerProvider?.toString(),
      })

      if (process.env.NODE_ENV === "production") {
        postHogClient.capture({
          distinctId: checkout._id,
          event: "Checkout Complete",
          properties: {
            referrer: checkout.referrer || "None",
            checkoutId: checkout._id,
            userId: newUser._id,
            signupPartner: checkout.signupPartner || "None",
            signupPartnerProvider: checkout.signupPartnerProvider || "None",
            insurancePay: checkout.insurancePlan ? true : false,
            environment: process.env.NODE_ENV,
          },
        })
      }

      await this.stripeSdk.paymentIntents.update(paymentIntentId, {
        metadata: {
          USER_ID: newUser._id,
          UPDATED_VIA_STRIPE_WEBHOOK_ON: new Date().toString(),
        },
      })

      await this.stripeSdk.customers.update(customerId, {
        metadata: {
          USER_ID: newUser._id,
          UPDATED_VIA_STRIPE_WEBHOOK_ON: new Date().toString(),
        },
      })

      checkout.user = newUser._id
      checkout.checkedOut = true
      await checkout.save()

      return this.sendSuccessResponse(
        res,
        `Stripe Webhook: payment_intent.succeeded: Successfully Created User (${newUser._id}) from Checkout with stripe payment intent id: ${paymentIntentId}`,
        {
          stripePaymentIntentId: paymentIntentId,
          stripeCustomerId: customerId,
          newUserId: newUser._id,
          checkoutId: checkout._id,
        }
      )
    } catch (err) {
      return this.sendErrorResponse(
        res,
        `Stripe Webhook: payment_intent.succeeded: Error creating user for stripe customer id: ${customerId}`,
        {
          stripePaymentIntentId: paymentIntentId,
          stripeCustomerId: customerId,
        }
      )
    }
  }

  async handleSetupIntentSucceeded(
    res: express.Response,
    setupIntent: Stripe.SetupIntent
  ) {
    const stripeSetupIntentId = setupIntent.id
    const { IGNORE_CHECKOUT } = setupIntent.metadata ?? {}
    const ignoreCheckout = IGNORE_CHECKOUT === "TRUE"

    const checkout = await CheckoutModel.findOne({
      stripeSetupIntentId,
    }).populate<{ signupPartner: SignupPartner }>("signupPartner")

    if (!checkout && !ignoreCheckout) {
      return this.sendErrorResponse(
        res,
        `Stripe Webhook: setup_intent.succeeded: Checkout not found for setup intent ID: ${stripeSetupIntentId}`,
        {
          setupIntentId: stripeSetupIntentId,
          ignoreCheckout,
        },
        null,
        400
      )
    }

    let stripeCustomerId: string | null =
      typeof setupIntent.customer === "object"
        ? setupIntent.customer?.id
        : setupIntent.customer
    const paymentMethodId =
      typeof setupIntent.payment_method === "object"
        ? setupIntent.payment_method?.id
        : setupIntent.payment_method

    if (ignoreCheckout && !stripeCustomerId) {
      return this.sendErrorResponse(
        res,
        "Stripe Webhook: setup_intent.succeeded: Cannot ignore checkout if stripeCustomerId is not set on setupIntent.",
        {
          setupIntentId: stripeSetupIntentId,
          ignoreCheckout,
          stripeCustomerId,
          checkoutId: checkout?._id,
        }
      )
    }

    if (!stripeCustomerId) {
      try {
        const stripeCustomer = await this.createStripeCustomerFromCheckout(
          checkout,
          paymentMethodId
        )

        checkout.stripeCustomerId = stripeCustomer.id
        stripeCustomerId = stripeCustomer.id

        await checkout.save()
      } catch (error) {
        return this.sendErrorResponse(
          res,
          `An error occurred creating stripe customer for setup intent: ${stripeSetupIntentId}`,
          {
            setupIntentId: stripeSetupIntentId,
            stripeCustomerId,
            ignoreCheckout,
            checkoutId: checkout._id,
          },
          error
        )
      }
    }

    if (checkout.insuranceCovered) {
      try {
        const stripePaymentIntent = await this.createPaymentIntent(
          stripeCustomerId,
          paymentMethodId,
          checkout ? { checkoutId: checkout._id } : null
        )

        return this.sendSuccessResponse(
          res,
          "Successfully created payment intent.",
          {
            paymentIntentId: stripePaymentIntent.id,
            setupIntentId: stripeSetupIntentId,
            stripeCustomerId,
          }
        )
      } catch (error) {
        return this.sendErrorResponse(
          res,
          `Error creating payment intent for stripe customer: ${stripeCustomerId} and setup intent ${stripeSetupIntentId}`,
          {
            stripeCustomerId,
            paymentMethodId,
          }
        )
      }
    } else {
      const details: Record<string, any> = {
        setupIntentId: stripeSetupIntentId,
        stripeCustomerId,
        ignoreCheckout,
        checkoutId: checkout?._id,
      }

      try {
        const priceId =
          checkout.signupPartner?.stripePriceId ?? this.defaultPriceId

        const subscription = await this.createSubscription(
          stripeCustomerId,
          paymentMethodId,
          priceId,
          { ORIGINAL_CHECKOUT_ID: checkout?._id }
        )

        if (!ignoreCheckout && checkout) {
          checkout.stripeSubscriptionId = subscription.id
          await checkout.save()
        }

        return this.sendSuccessResponse(
          res,
          "Created subscription successfully.",
          {
            ...details,
            subscriptionId: subscription.id,
          },
          201
        )
      } catch (error) {
        return this.sendErrorResponse(
          res,
          `Error creating subscription for setup intent ${stripeSetupIntentId}`,
          details,
          error
        )
      }
    }
  }

  async createPaymentIntent(
    stripeCustomerId: string,
    paymentMethodId: string,
    metadata?: Record<string, any>
  ): Promise<Stripe.PaymentIntent> {
    const stripePayment = await this.stripeSdk.paymentIntents.create({
      customer: stripeCustomerId,
      payment_method: paymentMethodId,
      amount: 100,
      currency: "USD",
      off_session: true,
      confirm: true,
      description: "Alfie - One Time Fee",
      metadata: {
        CREATED_VIA_STRIPE_WEBHOOK_ON: new Date().toString(),
        ...metadata,
      },
    })

    return stripePayment
  }

  private addressToStripeAddress(a: Address): Stripe.Address {
    return {
      line1: a.line1,
      line2: a.line2,
      city: a.city,
      state: a.state,
      postal_code: a.postalCode,
      country: "United States",
    }
  }

  async createStripeCustomerFromCheckout(
    checkout: Checkout,
    paymentMethodId: string
  ): Promise<Stripe.Customer> {
    const shippingAddress: Stripe.Address = this.addressToStripeAddress(
      checkout.shippingAddress
    )
    const billingAddress: Stripe.Address = this.addressToStripeAddress(
      checkout.billingAddress
    )

    const stripeCustomer = await this.stripeSdk.customers.create({
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
        address: shippingAddress,
      },
      address: checkout.sameAsShippingAddress
        ? shippingAddress
        : billingAddress,
      metadata: {
        CREATED_VIA_STRIPE_WEBHOOK_ON: new Date().toString(),
        ORIGINAL_CHECKOUT_ID: checkout._id,
      },
    })

    return stripeCustomer
  }

  async createSubscription(
    customerId: string,
    paymentMethodId: string,
    priceId: string,
    metadata?: Record<string, any>
  ): Promise<Stripe.Subscription> {
    const subscription = await this.stripeSdk.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      default_payment_method: paymentMethodId,
      collection_method: "charge_automatically",
      metadata: {
        CREATED_VIA_STRIPE_WEBHOOK_ON: new Date().toString(),
        ...(metadata ?? {}),
      },
    })

    return subscription
  }

  private sendSuccessResponse(
    res: express.Response,
    message: string,
    data: Record<string, any>,
    code = 200
  ) {
    captureEvent("info", message, data)
    return res.status(code).send({
      code,
      message,
      data,
    })
  }

  private sendErrorResponse(
    res: express.Response,
    message: string,
    data: Record<string, any>,
    error?: Error,
    code = 500
  ) {
    if (error) {
      captureException(error, message, data)
    } else {
      captureEvent("error", message, data)
    }

    return res.status(code).send({
      code,
      message,
      data,
    })
  }
}

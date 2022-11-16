import { ApolloError } from "apollo-server-errors"
import {
  CheckoutModel,
  CreateCheckoutInput,
  CreateStripeCustomerInput,
} from "../schema/checkout.schema"
import UserService from "./user.service"
import config from "config"
import stripe from "stripe"
import { addMonths } from "date-fns"
class CheckoutService extends UserService {
  private stripeSdk: stripe

  constructor() {
    super()
    this.stripeSdk = new stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2022-08-01",
    })
  }

  async completeCheckout(
    stripeSubscriptionId: string,
    subscriptionExpiresAt: Date
  ) {
    const { checkoutCompleted } = config.get("messages") as any
    const { notFound, alreadyCheckedOut } = config.get("errors.checkout") as any

    const checkout = await CheckoutModel.find()
      .findByStripeSubscriptionId(stripeSubscriptionId)
      .lean()

    if (!checkout) {
      throw new ApolloError(notFound.message, notFound.code)
    }

    if (checkout.checkedOut) {
      throw new ApolloError(alreadyCheckedOut.message, alreadyCheckedOut.code)
    }

    let expiresAt
    if (subscriptionExpiresAt) {
      expiresAt = subscriptionExpiresAt
    } else {
      expiresAt = addMonths(new Date(), 1)
    }

    const { user } = await this.createUser({
      name: checkout.name,
      email: checkout.email,
      phone: checkout.phone,
      dateOfBirth: checkout.dateOfBirth,
      address: checkout.shippingAddress,
      gender: checkout.gender,
      weightInLbs: checkout.weightInLbs,
      heightInInches: checkout.heightInInches,
      stripeCustomerId: checkout.stripeCustomerId,
      subscriptionExpiresAt: expiresAt,
      stripeSubscriptionId,
      textOptIn: checkout.textOptIn,
    })

    checkout.checkedOut = true
    checkout.user = user._id
    await CheckoutModel.findByIdAndUpdate(checkout._id, checkout)

    return {
      message: checkoutCompleted,
    }
  }

  async getCheckout(checkoutId: string) {
    const { checkoutNotFound, alreadyCheckedOut } = config.get(
      "errors.checkout"
    ) as any

    const checkout = await CheckoutModel.findById(checkoutId).lean()
    if (!checkout) {
      throw new ApolloError(checkoutNotFound.message, checkoutNotFound.code)
    }

    if (checkout.checkedOut) {
      throw new ApolloError(alreadyCheckedOut.message, alreadyCheckedOut.code)
    }

    return {
      checkout,
    }
  }

  async createStripeCheckoutSession({
    _id,
    shipping,
    billing,
    sameAsShipping,
  }: CreateStripeCustomerInput) {
    const { checkoutNotFound, alreadyCheckedOut } = config.get(
      "errors.checkout"
    ) as any

    const priceId = config.get("stripePriceId") as any

    const checkout = await CheckoutModel.findById(_id)

    if (!checkout) {
      throw new ApolloError(checkoutNotFound.message, checkoutNotFound.code)
    }

    if (checkout.checkedOut) {
      throw new ApolloError(alreadyCheckedOut.message, alreadyCheckedOut.code)
    }

    const stripeShipping = {
      line1: shipping.line1,
      line2: shipping.line2,
      city: shipping.city,
      state: shipping.state,
      postal_code: shipping.postalCode,
    }

    if (checkout.stripeCustomerId) {
      const customer = await this.stripeSdk.customers.retrieve(
        checkout.stripeCustomerId
      )

      await this.stripeSdk.customers.update(customer.id, {
        shipping: {
          name: checkout.name,
          address: stripeShipping,
        },
        address: sameAsShipping
          ? stripeShipping
          : {
              line1: billing.line1,
              line2: billing.line2,
              city: billing.city,
              state: billing.state,
              postal_code: billing.postalCode,
            },
      })

      const subscription = await this.stripeSdk.subscriptions.retrieve(
        checkout.stripeSubscriptionId,
        {
          expand: ["latest_invoice.payment_intent"],
        }
      )

      const latestInvoice = subscription.latest_invoice as any

      // update checkout with stripe info
      checkout.stripeClientSecret = latestInvoice.payment_intent.client_secret
      await checkout.save()

      return {
        checkout,
      }
    }

    // create customer
    const customer = await this.stripeSdk.customers.create({
      name: checkout.name,
      email: checkout.email,
      phone: checkout.phone,
      shipping: {
        name: checkout.name,
        address: stripeShipping,
      },
      address: sameAsShipping
        ? stripeShipping
        : {
            line1: billing.line1,
            line2: billing.line2,
            city: billing.city,
            state: billing.state,
            postal_code: billing.postalCode,
          },
    })

    // create subscription
    const subscription = await this.stripeSdk.subscriptions.create({
      customer: customer.id,
      items: [
        {
          price: priceId,
        },
      ],
      payment_behavior: "default_incomplete",
      payment_settings: { save_default_payment_method: "on_subscription" },
      expand: ["latest_invoice.payment_intent"],
    })

    const latestInvoice = subscription.latest_invoice as any

    // update checkout with stripe info
    checkout.stripeCustomerId = customer.id
    checkout.stripeSubscriptionId = subscription.id
    checkout.stripeClientSecret = latestInvoice.payment_intent.client_secret

    await checkout.save()

    return {
      checkout,
    }
  }

  async createOrFindCheckout(input: CreateCheckoutInput) {
    const { checkoutFound, checkoutCreated } = config.get("messages") as any
    const { alreadyCheckedOut } = config.get("errors.checkout") as any
    const { emailSubscribersTable } = config.get("dynamoDb") as any

    const {
      name,
      email,
      weightLossMotivator,
      dateOfBirth,
      gender,
      state,
      heightInInches,
      weightInLbs,
      textOptIn,
      phone,
    } = input

    const checkout = await CheckoutModel.find().findByEmail(email).lean()
    if (checkout) {
      // check if already checked out
      if (checkout.checkedOut) {
        throw new ApolloError(alreadyCheckedOut.message, alreadyCheckedOut.code)
      }

      // update values
      checkout.name = name
      checkout.weightLossMotivator = weightLossMotivator
      checkout.dateOfBirth = dateOfBirth
      checkout.gender = gender
      checkout.state = state
      checkout.heightInInches = heightInInches
      checkout.weightInLbs = weightInLbs
      checkout.textOptIn = textOptIn
      checkout.phone = phone

      // update in db
      await CheckoutModel.findByIdAndUpdate(checkout._id, checkout)

      // return updated checkout
      return {
        message: checkoutFound,
        checkout,
      }
    }

    // send to email subscriber lambda
    const { $response } = await this.awsDynamo
      .putItem({
        TableName: emailSubscribersTable,
        Item: {
          emailaddress: { S: email },
          fullname: { S: name },
          state: { S: state },
        },
      })
      .promise()

    if ($response.error) {
      console.log(
        "An error occured creating entry in dynamodb",
        $response.error.message
      )
    }

    // create new checkout
    const newCheckout = await CheckoutModel.create({
      name,
      email,
      weightLossMotivator,
      dateOfBirth,
      gender,
      state,
      heightInInches,
      weightInLbs,
      textOptIn,
      phone,
    })

    // return new checkout
    return {
      message: checkoutCreated,
      checkout: newCheckout,
    }
  }
}

export default CheckoutService

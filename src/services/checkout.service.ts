import { ApolloError } from "apollo-server-errors"
import {
  CheckoutModel,
  CompleteCheckoutInput,
  CreateCheckoutInput,
} from "../schema/checkout.schema"
import UserService from "./user.service"
import config from "config"
import stripe from "stripe"
import { addMonths } from "date-fns"
class CheckoutService extends UserService {
  stripeSdk: stripe

  constructor() {
    super()
    this.stripeSdk = new stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2022-08-01",
    })
  }

  async completeCheckout(input: CompleteCheckoutInput) {
    const { checkoutCompleted } = config.get("messages")
    const { notFound, alreadyCheckedOut } = config.get("errors.checkout")

    const {
      stripePaymentLinkId,
      phone,
      address,
      stripeCustomerId,
      subscriptionExpiresAt,
      stripeCheckoutId,
      stripeSubscriptionId,
    } = input
    const checkout = await CheckoutModel.find()
      .findByStripePaymentLinkId(stripePaymentLinkId)
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
      phone,
      dateOfBirth: checkout.dateOfBirth,
      address,
      gender: checkout.gender,
      weightInLbs: checkout.weightInLbs,
      heightInInches: checkout.heightInInches,
      stripeCustomerId,
      subscriptionExpiresAt: expiresAt,
      stripeSubscriptionId,
    })

    checkout.checkedOut = true
    checkout.stripeCheckoutId = stripeCheckoutId
    checkout.user = user._id
    await CheckoutModel.findByIdAndUpdate(checkout.id, checkout)

    return {
      message: checkoutCompleted,
    }
  }

  async getCheckout(checkoutId: string) {
    const { checkoutNotFound, alreadyCheckedOut } =
      config.get("errors.checkout")

    const checkout = await CheckoutModel.findById(checkoutId).lean()
    if (!checkout) {
      throw new ApolloError(checkoutNotFound.message, checkoutNotFound.code)
    }

    if (checkout.checkedOut) {
      throw new ApolloError(alreadyCheckedOut.message, alreadyCheckedOut.code)
    }

    const paymentLink = await this.getPaymentLink({
      paymentLinkId: checkout.stripePaymentLinkId,
    })

    return {
      checkout: {
        ...checkout,
        stripePaymentLinkId: paymentLink.id,
      },
      paymentLink,
    }
  }

  async getPaymentLink({
    paymentLinkId,
    update = true,
  }: {
    paymentLinkId?: string
    update?: boolean
  }) {
    const { defaultPriceId } = config.get("stripe")
    const baseUrl = config.get("baseUrl")
    const path = config.get("paths.checkoutSuccess")
    const url = `${baseUrl}/${path}`

    if (paymentLinkId) {
      const existingLink = await this.stripeSdk.paymentLinks.retrieve(
        paymentLinkId
      )
      if (!existingLink.active) {
        if (update) {
          await CheckoutModel.find()
            .findByStripePaymentLinkId(paymentLinkId)
            .updateOne({
              stripePaymentLinkId: paymentLinkId,
            })
        }

        return {
          id: existingLink.id,
          url: existingLink.url,
        }
      }
    }

    const paymentLink = await this.stripeSdk.paymentLinks.create({
      line_items: [{ price: defaultPriceId, quantity: 1 }],
      after_completion: { type: "redirect", redirect: { url } },
      shipping_address_collection: {
        allowed_countries: ["US"],
      },
      phone_number_collection: {
        enabled: true,
      },
    })

    return {
      id: paymentLink.id,
      url: paymentLink.url,
    }
  }

  async createOrFindCheckout(input: CreateCheckoutInput) {
    const { checkoutFound, checkoutCreated } = config.get("messages")
    const { alreadyCheckedOut } = config.get("errors.checkout")

    const {
      name,
      email,
      weightLossMotivator,
      dateOfBirth,
      gender,
      state,
      heightInInches,
      weightInLbs,
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

      const { id, url } = await this.getPaymentLink({
        update: false,
      })
      checkout.stripePaymentLinkId = id

      // update in db
      await CheckoutModel.findByIdAndUpdate(checkout._id, checkout)

      // return updated checkout
      return {
        message: checkoutFound,
        checkout,
        paymentLink: url,
      }
    }

    // send to email subscriber lambda
    await this.subscribeEmail({
      email,
      fullName: name,
      location: state,
      waitlist: false,
      currentMember: false,
    })

    const { id, url } = await this.getPaymentLink({})

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
      stripePaymentLinkId: id,
    })

    // return new checkout
    return {
      message: checkoutCreated,
      checkout: newCheckout,
      paymentLink: url,
    }
  }
}

export default CheckoutService

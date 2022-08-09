import { ApolloError } from "apollo-server-errors"
import { CheckoutModel, CreateCheckoutInput } from "../schema/checkout.schema"
import UserService from "./user.service"
import config from "config"

class CheckoutService extends UserService {
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

      // update in db
      await CheckoutModel.findByIdAndUpdate(checkout._id, checkout)

      // return updated checkout
      return {
        message: checkoutFound,
        checkout,
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

    // create stripe customer

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
      stripeCustomerId: "",
    })

    // return new checkout
    return {
      message: checkoutCreated,
      checkout: newCheckout,
    }
  }
}

export default CheckoutService

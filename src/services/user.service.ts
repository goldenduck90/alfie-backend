import { format } from "date-fns"
import { ApolloError } from "apollo-server-errors"
import axios from "axios"
import bcrypt from "bcrypt"
import config from "config"
import { addMinutes } from "date-fns"
import { triggerEntireSendBirdFlow } from "../utils/sendBird"
import { v4 as uuidv4 } from "uuid"
import {
  CreateUserInput,
  ForgotPasswordInput,
  LoginInput,
  ResetPasswordInput,
  Role,
  SubscribeEmailInput,
  UpdateSubscriptionInput,
  UserModel,
  Weight,
} from "../schema/user.schema"
import { signJwt } from "../utils/jwt"
import EmailService from "./email.service"
import TaskService from "./task.service"
import { createDrChronoUser } from "./authorizationToken.service"

class UserService extends EmailService {
  private taskService: TaskService

  constructor() {
    super()
    this.taskService = new TaskService()
  }

  async createUser(input: CreateUserInput, manual = false) {
    const { alreadyExists, unknownError, emailSendError } = config.get(
      "errors.createUser"
    ) as any
    const userCreatedMessage = config.get(
      manual
        ? "messages.userCreatedManually"
        : "messages.userCreatedViaCheckout"
    ) as any
    const {
      name,
      email,
      phone,
      role,
      dateOfBirth,
      address,
      weightInLbs,
      gender,
      heightInInches,
      stripeCustomerId,
      subscriptionExpiresAt,
      stripeSubscriptionId,
    } = input

    const existingUser = await UserModel.find().findByEmail(email).lean()
    if (existingUser) {
      throw new ApolloError(alreadyExists.message, alreadyExists.code)
    }

    const emailToken = uuidv4()

    const weights: Weight[] = []
    if (weightInLbs) {
      weights.push({
        date: new Date(),
        value: weightInLbs,
      })
    }

    const user = await UserModel.create({
      name,
      email,
      phone,
      role,
      emailToken,
      dateOfBirth,
      address,
      weights,
      gender,
      heightInInches,
      stripeCustomerId,
      subscriptionExpiresAt,
      stripeSubscriptionId,
    })
    if (!user) {
      throw new ApolloError(unknownError.message, unknownError.code)
    }

    // notify Alex's emailSubscribe flow that user signed up
    await this.subscribeEmail({
      email,
      fullName: name,
      location: "address.state",
      waitlist: false,
      currentMember: true,
    })
    await triggerEntireSendBirdFlow(user._id, user.name, "", "")
    const drChronoUser = {
      _id: user._id,
      first_name: user.name.split(" ")[0],
      last_name: user.name.split(" ")[1],
      gender: user.gender,
      date_of_birth: format(user.dateOfBirth, "yyyy-MM-dd"),
      email: user.email,
      doctor: 1,
    }
    await createDrChronoUser({ ...drChronoUser })
    // TODO: create patient entry in DrChrono

    // TODO: assign patient intake & id/insurance tasks to user

    // send email with link to set password
    const sent = await this.sendRegistrationEmail({
      email,
      token: emailToken,
      manual,
    })
    if (!sent) {
      throw new ApolloError(emailSendError.message, emailSendError.code)
    }

    return {
      message: userCreatedMessage,
      user,
    }
  }

  async updateSubscription(input: UpdateSubscriptionInput) {
    const { stripeSubscriptionId, subscriptionExpiresAt } = input
    const { notFound } = config.get("errors.updateSubscription") as any
    const message = config.get("messages.updateSubscription")

    const user = await UserModel.find()
      .findBySubscriptionId(stripeSubscriptionId)
      .lean()
    if (!user) {
      throw new ApolloError(notFound.message, notFound.code)
    }

    user.subscriptionExpiresAt = subscriptionExpiresAt
    await UserModel.findByIdAndUpdate(user._id, user)

    return { message }
  }

  async subscribeEmail(input: SubscribeEmailInput) {
    const { email, fullName, location, waitlist, currentMember } = input
    const { unknownError } = config.get("errors.subscribeEmail") as any
    const waitlistMessage = config.get("messages.subscribeEmail")
    const url = config.get("apiGatewayBaseUrl")
    const path = config.get("apiGatewayPaths.subscribeEmail")

    try {
      const { data } = await axios.post(
        `${url}${path}`,
        {
          emailAddress: email,
          name: fullName,
          location,
          waitlist,
          currentMember,
        },
        {
          headers: {
            "Content-Type": "application/json",
            "x-api-key": process.env.API_GATEWAY_KEY,
          },
        }
      )

      return {
        message: waitlist ? waitlistMessage : data,
      }
    } catch (error) {
      throw new ApolloError(unknownError.message, unknownError.code)
    }
  }

  async forgotPassword(input: ForgotPasswordInput) {
    const { email } = input
    const expirationInMinutes: number = config.get(
      "forgotPasswordExpirationInMinutes"
    )
    const { emailNotFound, emailSendError } = config.get(
      "errors.forgotPassword"
    ) as any
    const forgotPasswordMessage = config.get("messages.forgotPassword")

    // Get our user by email
    const user = await UserModel.find().findByEmail(email).lean()

    if (!user) {
      throw new ApolloError(emailNotFound.message, emailNotFound.code)
    }

    // set resetPasswordToken & resetPasswordTokenExpiresAt
    user.emailToken = Math.random().toString(36).slice(2, 16)
    user.emailTokenExpiresAt = addMinutes(new Date(), expirationInMinutes)

    await UserModel.findByIdAndUpdate(user._id, user)

    // send email with reset link
    const sent = await this.sendForgotPasswordEmail({
      email,
      token: user.emailToken,
    })

    if (!sent) {
      throw new ApolloError(emailSendError.message, emailSendError.code)
    }

    // send success message
    return {
      message: forgotPasswordMessage,
    }
  }

  async resetPassword(input: ResetPasswordInput) {
    const { token, password, registration } = input
    const { invalidToken, tokenExpired } = config.get(
      "errors.resetPassword"
    ) as any
    const resetPasswordMessage = config.get("messages.resetPassword")
    const completedRegistrationMessage = config.get(
      "messages.completedRegistration"
    )

    const user = await UserModel.find().findByEmailToken(token).lean()
    if (!user) {
      throw new ApolloError(invalidToken.message, invalidToken.code)
    }

    if (!registration && user.emailTokenExpiresAt < new Date()) {
      throw new ApolloError(tokenExpired.message, tokenExpired.code)
    }

    // set emailToken & emailTokenExpiresAt to null
    user.emailToken = null
    user.emailTokenExpiresAt = null
    user.password = await this.hashPassword(password)

    // update the user
    await UserModel.findByIdAndUpdate(user._id, user)

    // sign jwt
    const jwt = signJwt(
      {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      {
        expiresIn: config.get("jwtExpiration.normalExp"),
      }
    )

    return {
      message: registration
        ? completedRegistrationMessage
        : resetPasswordMessage,
      token: jwt,
      user,
    }
  }

  async hashPassword(password: string) {
    const salt = await bcrypt.genSalt(10)
    const hash = await bcrypt.hashSync(password, salt)
    return hash
  }

  async login(input: LoginInput) {
    const { email, password, remember, noExpire } = input
    const { invalidCredentials, passwordNotCreated } = config.get(
      "errors.login"
    ) as any
    const { rememberExp, normalExp } = config.get("jwtExpiration") as any

    // Get our user by email
    const user = (await UserModel.find().findByEmail(email).lean()) as any
    if (!user) {
      throw new ApolloError(invalidCredentials.message, invalidCredentials.code)
    }

    if (!user.password) {
      throw new ApolloError(passwordNotCreated.message, passwordNotCreated.code)
    }

    // validate the password
    const passwordIsValid = await bcrypt.compare(password, user.password)
    if (!passwordIsValid) {
      throw new ApolloError(invalidCredentials.message, invalidCredentials.code)
    }

    if (noExpire && user.role !== Role.Admin) {
      throw new ApolloError(invalidCredentials.message, invalidCredentials.code)
    }

    // sign a jwt
    const token = signJwt(
      {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      {
        ...(!noExpire && { expiresIn: remember ? rememberExp : normalExp }),
      }
    )

    // return the jwt & user
    return {
      token,
      user,
    }
  }

  async getUser(userId: string) {
    const { notFound } = config.get("errors.user") as any
    const user = await UserModel.findById(userId).lean()
    if (!user) {
      throw new ApolloError(notFound.message, notFound.code)
    }

    return user
  }
}

export default UserService

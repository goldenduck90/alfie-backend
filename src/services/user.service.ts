import { ApolloError } from "apollo-server-errors"
import bcrypt from "bcrypt"
import config from "config"
import { addMinutes } from "date-fns"
import {
  CreateUserInput,
  ForgotPasswordInput,
  LoginInput,
  ResetPasswordInput,
  User,
  UserModel,
} from "../schema/user.schema"
import { signJwt } from "../utils/jwt"
import EmailService from "./email.service"

class UserService extends EmailService {
  async createUser(input: CreateUserInput) {
    return UserModel.create(input)
  }

  async forgotPassword(input: ForgotPasswordInput) {
    const { email } = input
    const { emailNotFound, emailSendError } = config.get(
      "errors.forgotPassword"
    )
    const forgotPasswordMessage = config.get("messages.forgotPassword")

    // Get our user by email
    const user = await UserModel.find().findByEmail(email).lean()

    if (!user) {
      throw new ApolloError(emailNotFound.message, emailNotFound.code)
    }

    // set resetPasswordToken & resetPasswordTokenExpiresAt
    user.resetPasswordToken = Math.random().toString(36).slice(2, 16)
    user.resetPasswordTokenExpiresAt = addMinutes(new Date(), 30)

    await UserModel.findByIdAndUpdate(user._id, user)

    // send email with reset link
    const sent = await this.sendForgotPasswordEmail({
      email,
      token: user.resetPasswordToken,
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
    const { invalidToken, tokenExpired } = config.get("errors.resetPassword")
    const resetPasswordMessage = config.get("messages.resetPassword")
    const completedRegistrationMessage = config.get(
      "messages.completedRegistration"
    )

    let user: User | undefined = undefined
    if (registration) {
      user = await UserModel.find().findBySignupToken(token).lean()
    } else {
      user = await UserModel.find().findByResetPasswordToken(token).lean()
    }

    if (!user) {
      throw new ApolloError(invalidToken.message, invalidToken.code)
    }

    if (!registration && user.resetPasswordTokenExpiresAt < new Date()) {
      throw new ApolloError(tokenExpired.message, tokenExpired.code)
    }

    // set resetPasswordToken & resetPasswordTokenExpiresAt
    if (registration) {
      user.signupToken = null
    } else {
      user.resetPasswordToken = null
      user.resetPasswordTokenExpiresAt = null
    }
    user.emailVerified = true // they had to access their email to get here, so they are verified
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
    const { email, password, remember } = input
    const { invalidCredentials, emailNotVerified } = config.get("errors.login")
    const { rememberExp, normalExp } = config.get("jwtExpiration")

    // Get our user by email
    const user = await UserModel.find().findByEmail(email).lean()
    console.log(user)
    if (!user) {
      throw new ApolloError(invalidCredentials.message, invalidCredentials.code)
    }

    // validate the password
    const passwordIsValid = await bcrypt.compare(password, user.password)

    if (!passwordIsValid) {
      throw new ApolloError(invalidCredentials.message, invalidCredentials.code)
    }

    if (!user.emailVerified) {
      throw new ApolloError(emailNotVerified.message, emailNotVerified.code)
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
        expiresIn: remember ? rememberExp : normalExp,
      }
    )

    // return the jwt & user
    return {
      token,
      user,
    }
  }
}

export default UserService

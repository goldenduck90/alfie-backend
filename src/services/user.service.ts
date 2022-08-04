import { ApolloError } from "apollo-server-errors"
import bcrypt from "bcrypt"
import config from "config"
import { CreateUserInput, LoginInput, UserModel } from "../schema/user.schema"
import { signJwt } from "../utils/jwt"

class UserService {
  async createUser(input: CreateUserInput) {
    return UserModel.create(input)
  }

  async login(input: LoginInput) {
    const { email, password, remember } = input
    const { message, code } = config.get("errors.invalidCredentials")
    const { rememberExpiration, normalExpiration } = config.get("login")

    // Get our user by email
    const user = await UserModel.find().findByEmail(email).lean()

    if (!user) {
      throw new ApolloError(message, code)
    }

    // validate the password
    const passwordIsValid = await bcrypt.compare(password, user.password)

    if (!passwordIsValid) {
      throw new ApolloError(message, code)
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
        expiresIn: remember ? rememberExpiration : normalExpiration,
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

import { ApolloError } from "apollo-server-errors"
import bcrypt from "bcrypt"
import { CreateUserInput, LoginInput, UserModel } from "../schema/user.schema"
import { signJwt } from "../utils/jwt"

class UserService {
  async createUser(input: CreateUserInput) {
    return UserModel.create(input)
  }

  async login(input: LoginInput) {
    const e = "Invalid email or password"

    // Get our user by email
    const user = await UserModel.find().findByEmail(input.email).lean()

    if (!user) {
      throw new ApolloError(e, "FORBIDDEN")
    }

    // validate the password
    const passwordIsValid = await bcrypt.compare(input.password, user.password)

    if (!passwordIsValid) {
      throw new ApolloError(e, "FORBIDDEN")
    }

    // sign a jwt
    const token = signJwt({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    })

    // return the jwt
    return {
      token,
      user,
    }
  }
}

export default UserService

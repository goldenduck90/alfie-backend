import jwt from "jsonwebtoken"
import { User } from "../schema/user.schema"

export const signJwt = (
  // Add eaProviderId from the User.Provider schema
  object: Pick<User, "_id" | "name" | "email" | "role">,
  options?: jwt.SignOptions | undefined
) => {
  return jwt.sign(object, process.env.JWT_SECRET, {
    ...(options && options),
    algorithm: "HS256",
  })
}

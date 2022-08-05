import jwt from "jsonwebtoken"
import { User } from "../schema/user.schema"

export const signJwt = (
  object: Omit<
    User,
    | "password"
    | "emailVerified"
    | "signupToken"
    | "resetPasswordToken"
    | "resetPasswordTokenExpiresAt"
    | "createdAt"
    | "updatedAt"
  >,
  options?: jwt.SignOptions | undefined
) => {
  return jwt.sign(object, process.env.JWT_SECRET, {
    ...(options && options),
    algorithm: "HS256",
  })
}

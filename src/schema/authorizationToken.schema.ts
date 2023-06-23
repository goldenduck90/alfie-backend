import { Field, ObjectType, InputType } from "type-graphql"
import { getModelForClass, prop } from "@typegoose/typegoose"

@ObjectType()
export class AuthorizationToken {
  @Field(() => String)
  @prop({ required: true })
  token: string

  @Field(() => String)
  @prop({ required: false })
  refreshToken?: string

  @Field(() => Date)
  @prop({ required: false })
  expiresAt: Date

  @Field(() => Date, { nullable: true })
  @prop({ required: false })
  refreshTokenExpiresAt?: Date

  @Field(() => String)
  @prop({ required: true })
  provider: string
}

@InputType()
export class RefreshTokenInput {
  @Field(() => String)
  refreshToken: string
}

export const AuthorizationTokenModel = getModelForClass<
  typeof AuthorizationToken
>(AuthorizationToken, {
  schemaOptions: { timestamps: true },
})

import {
  getModelForClass,
  index,
  ModelOptions,
  pre,
  prop,
  queryMethod,
  ReturnModelType,
  Severity,
} from "@typegoose/typegoose"
import { AsQueryMethod, Ref } from "@typegoose/typegoose/lib/types"
import bcrypt from "bcrypt"
import {
  IsDate,
  IsEmail,
  IsPhoneNumber,
  MaxDate,
  MaxLength,
  MinLength,
} from "class-validator"
import config from "config"
import mongoose from "mongoose"
import {
  Field,
  Float,
  InputType,
  ObjectType,
  registerEnumType,
} from "type-graphql"
import { Provider } from "./provider.schema"
import { SignupPartner, SignupPartnerProvider } from "./partner.schema"
import Role from "./enums/Role"
import { InsurancePlanValue, InsuranceTypeValue } from "./insurance.schema"

const {
  email: emailValidation,
  phone: phoneValidation,
  password,
  dateOfBirth: dateOfBirthValidation,
} = config.get("validations") as any
const { rememberExp, normalExp } = config.get("jwtExpiration") as any

export enum FileType {
  InsuranceCard = "INSURANCE_CARD",
  PhotoId = "PHOTO_ID",
  Other = "OTHER",
}

registerEnumType(FileType, {
  name: "FileType",
  description: "Represents the file's purpose",
})

export enum Gender {
  Male = "Male",
  Female = "Female",
}

registerEnumType(Gender, {
  name: "Gender",
  description: "",
})

registerEnumType(Role, {
  name: "Role",
  description: "The user roles a user can be assigned to",
})

@ObjectType()
export class RoleResponse {
  @Field(() => Role)
  role: Role
}

@ObjectType()
@InputType("InsuranceInput")
@ModelOptions({ schemaOptions: { _id: false } })
export class Insurance {
  @Field(() => String)
  @prop({ required: true })
  memberId: string

  @Field(() => String)
  @prop({ required: true })
  groupId: string

  @Field(() => String)
  @prop({ required: true })
  insuranceCompany: string

  /** The payer ID. */
  @Field(() => String, { nullable: true })
  @prop()
  payor?: string

  @Field(() => String, { nullable: true })
  @prop()
  groupName?: string

  @Field(() => String, { nullable: true })
  @prop()
  rxBIN?: string

  @Field(() => String, { nullable: true })
  @prop()
  rxPCN?: string

  @Field(() => String, { nullable: true })
  @prop()
  rxGroup?: string
}

@ObjectType()
@InputType("AddressQuery")
@ModelOptions({ schemaOptions: { _id: false } })
export class AddressQuery {
  @Field(() => String)
  @prop({ required: true })
  input: string

  @Field(() => String, { nullable: true })
  @prop()
  radius?: number

  @Field(() => String, { nullable: true })
  @prop()
  location?: string // 37.76999%2C-122.44696

  @Field(() => String, { nullable: true })
  @prop()
  types?: string
}

@ObjectType()
@InputType("AddressSuggestion")
@ModelOptions({ schemaOptions: { _id: false } })
export class AddressSuggestion {
  @Field(() => String, { nullable: true })
  @prop({ required: true })
  placeId: string

  @Field(() => String, { nullable: true })
  @prop({ required: true })
  address: string
}

@ObjectType()
@InputType("PlaceDetails")
@ModelOptions({ schemaOptions: { _id: false } })
export class PlaceDetails {
  @Field(() => String, { nullable: true })
  @prop()
  line1: string

  @Field(() => String, { nullable: true })
  @prop()
  line2?: string

  @Field(() => String, { nullable: true })
  @prop()
  city: string

  @Field(() => String, { nullable: true })
  @prop()
  state: string

  @Field(() => String, { nullable: true })
  @prop()
  postalCode: string

  @Field(() => String, { nullable: true })
  @prop({ default: "US" })
  country?: string
}

@ObjectType()
@InputType("AddressInput")
@ModelOptions({ schemaOptions: { _id: false } })
export class Address {
  @Field(() => String)
  @prop({ required: true })
  line1: string

  @Field(() => String, { nullable: true })
  @prop()
  line2?: string

  @Field(() => String)
  @prop({ required: true })
  city: string

  @Field(() => String)
  @prop({ required: true })
  state: string

  @Field(() => String)
  @prop({ required: true })
  postalCode: string

  @Field(() => String, { nullable: true })
  @prop({ default: "US" })
  country?: string
}

@ObjectType()
export class Weight {
  @Field(() => Number)
  @prop({ required: true })
  value: number

  @Field(() => Date)
  @prop({ default: Date.now(), required: true })
  date: Date

  @Field(() => Boolean, { nullable: true })
  scale?: boolean
}

@ObjectType()
export class Score {
  @Field(() => Float, { nullable: true })
  @prop({ required: false })
  score?: number

  @Field(() => Float, { nullable: true })
  @prop({ required: false })
  percentile1Hour?: number

  @Field(() => Float, { nullable: true })
  @prop({ required: false })
  percentile?: number

  @Field(() => Float, { nullable: true })
  @prop({ required: false })
  calculatedPercentile?: number

  @Field(() => Float, { nullable: true })
  @prop({ required: false })
  calculatedPercentile1Hour?: number

  @Field(() => Float, { nullable: true })
  @prop({ required: false })
  calculatedPercentile30Minutes?: number

  @Field(() => Float, { nullable: true })
  @prop({ required: false })
  percentile30Minutes?: number

  @Field(() => String, { nullable: true })
  @prop({ required: false })
  latest?: string

  @Field(() => Float, { nullable: true })
  @prop({ required: false })
  percent?: number

  @Field(() => Float, { nullable: true })
  @prop({ required: false })
  percentDifference?: number

  @Field(() => Boolean, { nullable: true })
  @prop({ required: false })
  increased?: boolean

  @Field(() => String, { nullable: true })
  @prop({ required: false })
  message?: string

  @Field(() => String, { nullable: true })
  @prop({ required: false })
  task?: string

  @Field(() => Date, { nullable: true })
  @prop({ default: Date.now(), required: false })
  date: Date

  @Field(() => Boolean, { nullable: true })
  @prop({ required: false })
  increased1Hour?: boolean

  @Field(() => Boolean, { nullable: true })
  @prop({ required: false })
  increased30Minutes?: boolean

  @Field(() => Number, { nullable: true })
  @prop({ required: false })
  currentScore?: number

  @Field(() => Float, { nullable: true })
  @prop({ required: false })
  percentDifference1Hour?: number

  @Field(() => Float, { nullable: true })
  @prop({ required: false })
  percentDifference30Minutes?: number

  @Field(() => Float, { nullable: true })
  @prop({ required: false })
  scoreSystolic?: number

  @Field(() => Float, { nullable: true })
  @prop({ required: false })
  scoreDiastolic?: number

  @Field(() => Boolean, { nullable: true })
  @prop({ required: false })
  increasedSystolic?: boolean

  @Field(() => Boolean, { nullable: true })
  @prop({ required: false })
  increasedDiastolic?: boolean

  @Field(() => Float, { nullable: true })
  @prop({ required: false })
  percentDifferenceSystolic?: number

  @Field(() => Float, { nullable: true })
  @prop({ required: false })
  percentDifferenceDiastolic?: number

  @Field(() => String, { nullable: true })
  @prop({ required: false })
  providerMessage?: string
}

export enum ClassificationType {
  Empath = "Empath",
  Ember = "Ember",
  Growler = "Growler",
  Rover = "Rover",
}

@ObjectType()
export class Classification {
  @Field()
  @prop({ required: true })
  classification: ClassificationType

  @Field(() => Number)
  @prop({ required: true })
  percentile: number

  @Field(() => Float, { nullable: true })
  @prop({ required: false })
  calculatedPercentile?: number

  @Field(() => Date)
  @prop({ required: true })
  date: Date
}

@ObjectType()
@InputType("FileMetadataInput")
export class FileMetadata {
  @Field(() => String)
  @prop({ required: true })
  key: string

  @Field(() => String)
  @prop({ required: true })
  value: string
}

@ObjectType()
@InputType("FileInput")
export class File {
  @Field(() => String)
  @prop({ required: true })
  key: string

  @Field(() => String)
  @prop({ required: true })
  url: string

  @Field(() => String)
  @prop({ required: true })
  ETag: string

  @Field(() => FileType)
  @prop({ required: true, default: FileType.Other })
  type: FileType

  @Field(() => String)
  @prop({ required: true })
  contentType: string

  @Field(() => [FileMetadata], { nullable: true })
  @prop({ default: [], required: true })
  metadata?: mongoose.Types.Array<FileMetadata>

  @Field(() => String, { nullable: true })
  @prop()
  versionId?: string

  @Field(() => Date, { nullable: true })
  @prop({ default: Date.now(), required: true })
  createdAt?: Date
}

function findByEmail(
  this: ReturnModelType<typeof User, QueryHelpers>,
  email: User["email"]
) {
  return this.findOne({ email })
}

function findByEmailToken(
  this: ReturnModelType<typeof User, QueryHelpers>,
  emailToken: User["emailToken"]
) {
  return this.findOne({ emailToken })
}

function findBySubscriptionId(
  this: ReturnModelType<typeof User, QueryHelpers>,
  stripeSubscriptionId: User["stripeSubscriptionId"]
) {
  return this.findOne({ stripeSubscriptionId })
}
interface QueryHelpers {
  findByEmail: AsQueryMethod<typeof findByEmail>
  findByEmailToken: AsQueryMethod<typeof findByEmailToken>
  findBySubscriptionId: AsQueryMethod<typeof findBySubscriptionId>
}

@pre<User>("save", async function () {
  if (!this.password) return
  if (!this.isModified("password")) return

  const salt = await bcrypt.genSalt(10)
  const hash = await bcrypt.hashSync(this.password, salt)

  this.password = hash
})
@index({ email: 1 }, { unique: true })
@queryMethod(findByEmail)
@queryMethod(findByEmailToken)
@queryMethod(findBySubscriptionId)
@ModelOptions({ options: { allowMixed: Severity.ALLOW } })
@ObjectType()
@ModelOptions({ options: { allowMixed: Severity.ALLOW } })
export class User {
  @Field(() => String)
  _id: string

  @Field(() => Boolean, { nullable: true })
  @prop({ nullable: true })
  textOptIn: boolean

  @Field(() => String, { nullable: true })
  @prop({ nullable: true })
  generatedSummary?: string

  @Field(() => [Classification], { nullable: true })
  @prop({ default: [] })
  classifications: Classification[]

  @Field(() => String, { nullable: true })
  meetingRoomUrl: string

  @Field(() => String, { nullable: true })
  sendbirdChannelUrl: string

  @Field(() => String)
  @prop({ required: true })
  name: string

  @Field(() => String)
  @prop({ required: true })
  email: string

  @Field(() => String)
  @prop()
  phone?: string

  @Field(() => String)
  @prop()
  password?: string

  @Field(() => Role)
  @prop({
    default: Role.Patient,
    required: true,
  })
  role: Role

  @Field(() => String)
  @prop()
  emailToken?: string

  @Field(() => Date)
  @prop()
  emailTokenExpiresAt?: Date

  @Field(() => Date)
  @prop({ required: true })
  dateOfBirth: Date

  @Field(() => Address)
  @prop()
  address: Address

  @Field(() => Number, { nullable: true })
  @prop()
  weightGoal: number

  @Field(() => [Weight])
  @prop({ default: [], required: true })
  weights: Weight[]

  @Field(() => [Score])
  @prop({ default: [], required: false })
  score: Score[]

  @Field(() => Gender)
  @prop({ enum: Gender, type: String, required: true })
  gender: Gender

  @Field(() => Number)
  @prop({ required: true })
  heightInInches: number

  @Field(() => String, { nullable: true })
  @prop()
  akutePatientId?: string

  @Field(() => String)
  @prop()
  calId?: string

  @Field(() => String)
  @prop()
  stripeCustomerId?: string

  @Field(() => String, { nullable: true })
  @prop({ required: false, default: null })
  stripeSubscriptionId?: string

  @Field(() => String, { nullable: true })
  @prop({ required: false, default: null })
  stripePaymentIntentId?: string

  @Field(() => String, { nullable: true })
  @prop()
  eaCustomerId?: string

  @Field(() => String, { nullable: true })
  @prop()
  eaHealthCoachId?: string

  @Field(() => String, { nullable: true })
  @prop()
  externalPatientId?: string

  @Field(() => String, { nullable: true })
  @prop()
  metriportUserId?: string

  @Field(() => Date)
  @prop({ default: Date.now(), required: true })
  subscriptionExpiresAt: Date

  @Field(() => [File])
  @prop({ default: [], required: true })
  files: mongoose.Types.Array<File>

  @Field(() => Provider, { nullable: true })
  @prop({ ref: () => Provider, required: false })
  provider: Ref<Provider>

  @Field(() => String, { nullable: true })
  @prop()
  pharmacyLocation?: string

  @Field(() => String, { nullable: true })
  @prop()
  timezone?: string

  @Field(() => String, { nullable: true })
  @prop()
  meetingUrl?: string

  @Field(() => Boolean, { defaultValue: false })
  @prop({ default: false, required: true })
  labOrderSent: boolean

  @Field(() => Number, { nullable: true })
  @prop()
  bmi?: number

  @Field(() => Boolean, { defaultValue: false })
  @prop()
  hasScale?: boolean

  @Field(() => Insurance, { nullable: true })
  @prop({ required: false })
  insurance?: Insurance

  @Field(() => InsurancePlanValue, { nullable: true })
  @prop({ enum: InsurancePlanValue, type: String, required: false })
  insurancePlan?: InsurancePlanValue

  @Field(() => InsuranceTypeValue, { nullable: true })
  @prop({ enum: InsuranceTypeValue, type: String, required: false })
  insuranceType?: InsuranceTypeValue

  @Field(() => Boolean, { defaultValue: false })
  @prop({ default: false, required: false })
  insuranceCovered: boolean

  @Field(() => SignupPartner, { nullable: true })
  @prop({ ref: () => SignupPartner, required: false })
  signupPartner?: Ref<SignupPartner>

  @Field(() => SignupPartnerProvider, { nullable: true })
  @prop({ ref: () => SignupPartnerProvider, required: false })
  signupPartnerProvider?: Ref<SignupPartnerProvider>
}

export const UserModel = getModelForClass<typeof User, QueryHelpers>(User, {
  schemaOptions: { timestamps: true },
})
@InputType()
export class UpdateUserInput {
  @Field(() => String)
  userId: string

  @Field(() => String)
  stripeCustomerId: string

  @Field(() => String)
  stripeSubscriptionId: string

  @Field(() => Date)
  subscriptionExpiresAt: Date
}

@InputType()
export class CreateUserInput {
  @Field(() => String)
  name: string

  @Field(() => Boolean, { nullable: true })
  textOptIn: boolean

  @IsEmail({}, { message: emailValidation.message })
  @Field(() => String)
  email: string

  @IsPhoneNumber("US", { message: phoneValidation.message })
  @Field(() => String, { nullable: true })
  phone?: string

  @MinLength(password.length.minValue, {
    message: password.length.minMessage,
  })
  @MaxLength(password.length.maxValue, {
    message: password.length.maxMessage,
  })
  @Field(() => String, {
    nullable: true,
    description:
      "If no password is provided, an email will be sent to create one.",
  })
  password?: string

  @Field(() => Role, {
    nullable: true,
    description: "If no role is provided, defaults to Patient.",
  })
  role?: Role

  @IsDate({
    message: dateOfBirthValidation.message,
  })
  @MaxDate(
    new Date(
      `${new Date().getFullYear() - dateOfBirthValidation.minAge.value}-01-01`
    ),
    {
      message: dateOfBirthValidation.minAge.message,
    }
  )
  @Field(() => Date, {
    description: `User must be atleast ${dateOfBirthValidation.minAge.value} years old.`,
  })
  dateOfBirth: Date

  @Field(() => Address, {
    nullable: true,
    description:
      "If not provided, user will be assigned a task to provide this information.",
  })
  address?: Address

  @Field(() => Number, {
    nullable: true,
    description: "Current weight in lbs.",
  })
  weightInLbs?: number

  @Field(() => Gender)
  gender: Gender

  @Field(() => Number, { description: "Height in inches." })
  heightInInches: number

  @Field(() => String, {
    nullable: true,
    description: "If not provided, will be set after checkout.",
  })
  stripeCustomerId?: string

  @Field(() => String, {
    nullable: true,
    description:
      "EasyAppointments Customer ID. If not provided, will be created after checkout.",
  })
  eaCustomerId?: string

  @Field(() => String, {
    nullable: true,
    description:
      "Provider ID associated the user to a specific provider in our system.",
  })
  providerId?: string

  @Field(() => String, {
    nullable: true,
    description:
      "EasyAppointments Health Coach ID. If not provided, will be assigned after the patient has their first appointment.",
  })
  eaHealthCoachId?: string

  @Field(() => String, {
    nullable: true,
    description: "If not provided, will be set after checkout.",
  })
  stripeSubscriptionId?: string

  @Field(() => String, {
    nullable: true,
    description: "If not provided, will be set after checkout.",
  })
  stripePaymentIntentId?: string

  @Field(() => Date, {
    nullable: true,
    description:
      "When the user's subscription expires. If not provided, the subscription won't be active.",
  })
  subscriptionExpiresAt?: Date

  @Field(() => String, {
    nullable: true,
    description: "If not provided, will be set when scale is activated.",
  })
  metriportUserId?: string

  @Field(() => Insurance, { nullable: true })
  insurance?: Insurance

  @Field(() => InsurancePlanValue, { nullable: true })
  insurancePlan?: InsurancePlanValue

  @Field(() => InsuranceTypeValue, { nullable: true })
  insuranceType?: InsuranceTypeValue

  @Field(() => Boolean, { nullable: true })
  insuranceCovered?: boolean

  @Field(() => String, { nullable: true })
  signupPartnerId?: string

  @Field(() => String, { nullable: true })
  signupPartnerProviderId?: string
}

@InputType()
export class LoginInput {
  @IsEmail({}, { message: emailValidation.message })
  @Field(() => String)
  email: string

  @Field(() => String)
  password: string

  @Field(() => Boolean, {
    nullable: true,
    description: `If not set token will expire in ${normalExp}. If set to true, token will expire in ${rememberExp}.`,
  })
  remember: boolean

  @Field(() => Boolean, {
    nullable: true,
    description: "Only useable by admins to generate auth tokens",
  })
  noExpire?: boolean
}

@ObjectType()
export class PartialUser {
  @Field(() => String)
  _id: string

  @Field(() => String)
  name: string

  @Field(() => String)
  email: string

  @Field(() => Role)
  role: Role

  @Field(() => String, { nullable: true })
  eaProviderId?: string
  @Field(() => String, { nullable: true })
  eaHealthCoachId?: string
}

@ObjectType()
export class LoginResponse {
  @Field(() => String, { nullable: true })
  message: string

  @Field(() => String)
  token: string

  @Field(() => PartialUser)
  user: PartialUser
}

@InputType()
export class ForgotPasswordInput {
  @IsEmail({}, { message: emailValidation.message })
  @Field(() => String)
  email: string
}

@InputType()
export class ResetPasswordInput {
  @Field(() => String)
  token: string

  @MinLength(password.length.minValue, {
    message: password.length.minMessage,
  })
  @MaxLength(password.length.maxValue, {
    message: password.length.maxMessage,
  })
  @Field(() => String)
  password: string

  @Field(() => Boolean)
  registration: boolean
}

@ObjectType()
export class MessageResponse {
  @Field(() => String)
  message: string
}

@InputType()
export class SubscribeEmailInput {
  @IsEmail({}, { message: emailValidation.message })
  @Field(() => String)
  email: string

  @Field(() => String)
  fullName: string

  @Field(() => String)
  location: string

  @Field(() => Boolean)
  waitlist: boolean

  @Field(() => Boolean)
  currentMember: boolean
}

@InputType()
export class UpdateSubscriptionInput {
  @Field(() => String)
  stripeSubscriptionId: string

  @Field(() => Date)
  subscriptionExpiresAt: Date
}

@InputType()
export class CompletePaymentIntentInput {
  @Field(() => String)
  paymentIntentId: string
}

@InputType()
export class SignedUrlRequest {
  @Field(() => String)
  key: string

  /** Metadata for the upload image for put requests. */
  @Field(() => [FileMetadata], { nullable: true })
  metadata?: FileMetadata[]

  @Field(() => String)
  contentType: string

  /** The type of the request ("get" or "put"). Defaults to "put". */
  @Field(() => String, { defaultValue: "put" })
  requestType: string

  /** Include version ID for get requests. */
  @Field(() => String, { nullable: true })
  versionId?: string
}

@ObjectType()
export class SignedUrlResponse {
  @Field(() => String)
  key: string

  @Field(() => String)
  url: string
}

@InputType()
export class CreatePatientInput {
  @Field(() => String)
  firstName: string

  @Field(() => String)
  lastName: string

  @IsEmail({}, { message: emailValidation.message })
  @Field(() => String)
  email: string

  @IsDate({
    message: dateOfBirthValidation.message,
  })
  @MaxDate(
    new Date(
      `${new Date().getFullYear() - dateOfBirthValidation.minAge.value}-01-01`
    ),
    {
      message: dateOfBirthValidation.minAge.message,
    }
  )
  @Field(() => Date, {
    description: `User must be atleast ${dateOfBirthValidation.minAge.value} years old.`,
  })
  dateOfBirth: Date

  @Field(() => Gender)
  sex: Gender

  @Field(() => Address)
  address: Address

  @IsPhoneNumber("US", { message: phoneValidation.message })
  @Field(() => String)
  phone: string
}

@ObjectType()
export class UserSendbirdChannel {
  @Field(() => String)
  channel_url: string

  @Field(() => String)
  name: string

  @Field(() => String, { nullable: true })
  cover_url?: string

  @Field(() => String, { nullable: true })
  data?: string

  @Field(() => Number)
  member_count: number

  @Field(() => Number)
  joined_member_count: number

  @Field(() => Number)
  max_length_message: number

  @Field(() => Number)
  created_at: number

  @Field(() => String, { nullable: true })
  custom_type?: string

  @Field(() => Boolean)
  is_distinct: boolean

  @Field(() => Boolean)
  is_super: boolean

  @Field(() => Boolean)
  is_broadcast: boolean

  @Field(() => Boolean)
  is_public: boolean

  @Field(() => Boolean)
  is_discoverable: boolean

  @Field(() => Boolean)
  freeze: boolean

  @Field(() => Boolean)
  is_ephemeral: boolean

  @Field(() => Number)
  unread_message_count: number

  @Field(() => Number)
  unread_mention_count: number

  @Field(() => Boolean)
  ignore_profanity_filter: boolean

  @Field(() => String, { nullable: true })
  count_preference?: string

  @Field(() => String, { nullable: true })
  created_by?: string

  @Field(() => Boolean)
  is_access_code_required: boolean

  @Field(() => Boolean)
  is_exclusive: boolean

  @Field(() => Boolean)
  is_muted: boolean

  @Field(() => Boolean)
  is_push_enabled: boolean

  @Field(() => String)
  member_state: string

  @Field(() => Number)
  message_survival_seconds: number

  @Field(() => String, { nullable: true })
  my_role?: string

  @Field(() => String, { nullable: true })
  push_trigger_option?: string

  // @Field(() => Object, { nullable: true })
  // sms_fallback?: Object

  @Field(() => Number)
  ts_message_offset: number

  @Field(() => Number)
  user_last_read: number

  @Field(() => String, { nullable: true })
  inviter?: string

  @Field(() => Number)
  invited_at: number

  @Field(() => Boolean)
  is_hidden: boolean

  @Field(() => String, { nullable: true })
  hidden_state?: string

  @Field(() => Number, { nullable: true })
  joined_ts?: number
}

@ObjectType()
export class InsuranceEligibilityResponse {
  @Field(() => Boolean)
  eligible: boolean

  @Field(() => String, { nullable: true })
  reason?: string

  @Field(() => Insurance, { nullable: true })
  rectifiedInsurance?: Insurance
}

@InputType()
export class ScaleReadingInput {
  @Field(() => String)
  metriportUserId: string

  @Field(() => Number)
  weightLbs: number
}

import * as Sentry from "@sentry/node"
import { ApolloError } from "apollo-server-errors"
import { LeanDocument } from "mongoose"
import { createObjectCsvWriter } from "csv-writer"
import * as AWS from "aws-sdk"
import bcrypt from "bcrypt"
import config from "config"
import {
  addDays,
  addMinutes,
  addMonths,
  isPast,
  isToday,
  format,
  isTomorrow,
  isThisWeek,
} from "date-fns"
import {
  ChatCompletionRequestMessageRoleEnum,
  Configuration,
  OpenAIApi,
} from "openai"
import stripe from "stripe"
import { v4 as uuidv4 } from "uuid"
import {
  Checkout,
  CheckoutModel,
  CreateCheckoutInput,
  CheckoutAddressInput,
} from "../schema/checkout.schema"
import { ProviderModel, Provider } from "../schema/provider.schema"
import { AllTaskEmail, Task, TaskEmail, TaskType } from "../schema/task.schema"
import {
  UserNumberAnswer,
  UserTaskModel,
  UserTask,
} from "../schema/task.user.schema"
import {
  CreateUserInput,
  ForgotPasswordInput,
  LoginInput,
  ResetPasswordInput,
  SubscribeEmailInput,
  UpdateUserInput,
  Weight,
  File,
  User,
} from "../schema/user.schema"
import Role from "../schema/enums/Role"
import { signJwt } from "../utils/jwt"
import {
  createSendBirdUser,
  findSendBirdUser,
  getSendBirdUserChannels,
  inviteUserToChannel,
  leaveUserFromChannel,
  triggerEntireSendBirdFlow,
} from "../utils/sendBird"
import { TaskModel } from "./../schema/task.schema"
import { UserModel } from "./../schema/user.schema"
import { protocol } from "./../utils/protocol"
import AkuteService from "./akute.service"
import AppointmentService from "./appointment.service"
import EmailService from "./email.service"
import ProviderService from "./provider.service"
import TaskService from "./task.service"
import SmsService from "./sms.service"
import CandidService from "./candid.service"
import WithingsService, { TEST_MODE } from "./withings.service"
import FaxService from "./fax.service"
import axios from "axios"
import AnswerType from "../schema/enums/AnswerType"
import postHogClient from "../utils/posthog"
import {
  SignupPartner,
  SignupPartnerModel,
  SignupPartnerProviderModel,
} from "../schema/partner.schema"
import { captureException, captureEvent } from "../utils/sentry"
import StripeService from "./stripe.service"
import { calculateBMI } from "../utils/calculateBMI"
import { InsuranceDetails, InsuranceStatus } from "../schema/insurance.schema"
import { AlertModel, Alert } from "../schema/alert.schema"
import MetriportService from "./metriport.service"

export const initialUserTasks = [
  TaskType.ID_AND_INSURANCE_UPLOAD,
  TaskType.NEW_PATIENT_INTAKE_FORM,
  TaskType.MP_HUNGER,
  TaskType.MP_FEELING,
  TaskType.BP_LOG,
  // TaskType.WEIGHT_LOG,
  TaskType.WAIST_LOG,
  // TaskType.MP_BLUE_CAPSULE,
  TaskType.MP_ACTIVITY,
  TaskType.FOOD_LOG,
  TaskType.TEFQ,
  TaskType.AD_LIBITUM,
  TaskType.GSRS,
  TaskType.CONNECT_WITHINGS_SCALE,
]

class UserService extends EmailService {
  private taskService: TaskService
  private providerService: ProviderService
  private akuteService: AkuteService
  private appointmentService: AppointmentService
  private smsService: SmsService
  private emailService: EmailService
  private candidService: CandidService
  private withingsService: WithingsService
  private faxService: FaxService
  public awsDynamo: AWS.DynamoDB
  private stripeService: StripeService
  private metriportService: MetriportService

  constructor() {
    super()

    this.taskService = new TaskService()
    this.providerService = new ProviderService()
    this.akuteService = new AkuteService()
    this.appointmentService = new AppointmentService()
    this.smsService = new SmsService()
    this.emailService = new EmailService()
    this.candidService = new CandidService()
    this.withingsService = new WithingsService()
    this.faxService = new FaxService()
    this.stripeService = new StripeService(this)
    this.metriportService = new MetriportService()

    this.awsDynamo = new AWS.DynamoDB({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION,
    })
  }

  async assignUserTasks(userId: string, taskTypes: TaskType[]) {
    try {
      const input = {
        userId,
        taskTypes,
      }
      return await this.taskService.bulkAssignTasksToUser(input)
    } catch (error) {
      console.error(error, "error in assignUserTasks")
    }
  }

  async updateUser(input: UpdateUserInput) {
    const { emailSendError } = config.get("errors.createUser") as any

    const userCreatedMessage = config.get(
      "messages.userCreatedViaCheckout"
    ) as any

    const {
      userId,
      stripeCustomerId,
      subscriptionExpiresAt,
      stripeSubscriptionId,
    } = input

    const user = await UserModel.findById(userId)
    const emailToken = uuidv4()
    user.emailToken = emailToken
    user.stripeCustomerId = stripeCustomerId
    user.stripeSubscriptionId = stripeSubscriptionId
    user.subscriptionExpiresAt = subscriptionExpiresAt
    await user.save()

    // send email with link to set password
    let sent
    if (user.signupPartner) {
      //TODO: Send partner specific registration email, use the same email for now
      sent = await this.sendRegistrationEmailTemplate({
        email: user.email,
        token: emailToken,
        name: user.name,
      })
    } else {
      sent = await this.sendRegistrationEmailTemplate({
        email: user.email,
        token: emailToken,
        name: user.name,
      })
    }

    if (!sent) {
      throw new ApolloError(emailSendError.message, emailSendError.code)
    }

    return {
      message: userCreatedMessage,
      user,
    }
  }

  async createUser(input: CreateUserInput, manual = false) {
    input.email = input.email.toLowerCase()

    console.log("create user", JSON.stringify(input))
    const { alreadyExists, unknownError, emailSendError } = config.get(
      "errors.createUser"
    ) as any
    const { emailSubscribersTable, waitlistTable } = config.get(
      "dynamoDb"
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
      metriportUserId,
      providerId,
      textOptIn,
      insurance,
      signupPartnerId,
      signupPartnerProviderId,
    } = input

    const existingUser = await UserModel.find().findByEmail(email)
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

    let provider = {
      _id: providerId,
    }

    if (!providerId) {
      provider = await this.providerService.getNextAvailableProvider(
        address.state,
        true
      )
      if (!provider) {
        throw new ApolloError(
          `Could not select provider for user's state: ${address.state}`,
          "NOT_FOUND"
        )
      }
    }

    console.log(`CREATING NEW USER w/Name: ${name}`)

    const splitName = name.split(" ")
    const firstName = splitName[0] || ""
    const lastName = splitName[splitName.length - 1] || ""

    let patientId: string
    try {
      patientId = await this.akuteService.createPatient({
        firstName,
        lastName,
        email,
        phone,
        dateOfBirth,
        address,
        sex: gender,
      })
      if (!patientId) {
        const message = `UserService.createUser: An error occured for creating a patient entry in Akute for: ${email}`
        captureEvent("error", message)
      }
    } catch (error) {
      captureException(error, "UserService.createUser", input)
    }

    const customerId = await this.appointmentService.createCustomer({
      userId: "",
      firstName,
      lastName,
      email,
      phone,
      address: `${address.line1} ${address.line2 || ""}`,
      city: address.city,
      zipCode: address.postalCode,
      state: address.state,
      updateUser: false,
      timezone: "UTC",
    })
    if (!customerId) {
      throw new ApolloError(
        `An error occured for creating a customer entry in Easy Appointments for: ${email}`,
        "INTERNAL_SERVER_ERROR"
      )
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
      metriportUserId,
      eaCustomerId: customerId,
      akutePatientId: patientId,
      provider: provider._id,
      textOptIn,
      insurance,
      signupPartner: signupPartnerId,
      signupPartnerProvider: signupPartnerProviderId,
    })
    if (!user) {
      throw new ApolloError(unknownError.message, unknownError.code)
    }

    try {
      await this.metriportService.createPatient({
        userId: user._id,
        name,
        address,
        gender,
        dob: dateOfBirth,
      })
    } catch (err) {
      console.log(
        "Metriport patient creation failed... skipping but logging to sentry"
      )
    }

    // delete user from email subscribers table
    const { $response } = await this.awsDynamo
      .deleteItem({
        TableName: emailSubscribersTable,
        Key: {
          emailaddress: {
            S: email,
          },
        },
      })
      .promise()

    if ($response.error) {
      console.log(
        "An error occured deleting user from DynamoDB",
        $response.error.message
      )
    }

    const { $response: $response2 } = await this.awsDynamo
      .deleteItem({
        TableName: waitlistTable,
        Key: {
          emailaddress: {
            S: email,
          },
        },
      })
      .promise()

    if ($response2.error) {
      console.log(
        "An error occured deleting user from DynamoDB",
        $response2.error.message
      )
    }

    // trigger sendbird flow
    await triggerEntireSendBirdFlow({
      user_id: user._id,
      nickname: user.name,
      profile_file: "",
      profile_url: "",
      provider_id: provider._id,
    })

    // assign initial tasks to user
    const tasks = initialUserTasks
    await this.assignUserTasks(user._id, tasks)

    // send email with link to set password
    const sent = await this.sendRegistrationEmailTemplate({
      email,
      token: emailToken,
      manual,
      name,
    })

    if (!sent) {
      throw new ApolloError(emailSendError.message, emailSendError.code)
    }

    if (signupPartnerId && signupPartnerProviderId) {
      const signupPartner = await SignupPartnerModel.findById(signupPartnerId)
      const signupPartnerProvider = await SignupPartnerProviderModel.findById(
        signupPartnerProviderId
      )

      await this.sendReferralEmail({
        email,
        name,
        phone,
        source: signupPartner.title,
        provider: signupPartnerProvider.title,
      })
    }

    // send lab order
    try {
      await this.akuteService.createLabOrder(user._id)
    } catch (err) {
      console.log(err)
    }

    // create insurance in akute
    // NOTE: Currently, this is not supported as we dont store rx details
    // on insurance which is required by akute
    // if (user.insurance) {
    //   try {
    //     await this.akuteService.createInsurance(
    //       user.akutePatientId,
    //       user.insurance
    //     )
    //   } catch (err) {
    //     console.log(err)
    //   }
    // }

    if (process.env.NODE_ENV === "production") {
      try {
        const zapierCreateUserWebhook = config.get(
          "zapierCreateUserWebhook"
        ) as string

        // zapier webhook send
        await axios.post(zapierCreateUserWebhook, {
          user: {
            _id: user._id,
            email: user.email,
            phone: user.phone,
            address: user.address,
            name: user.name,
          },
        })
      } catch (err) {
        console.log(
          "An error occured hitting zappier create user webhook",
          err.message
        )
      }
    }

    // Create withings dropshipping order and send email to patients@joinalfie.com
    let status
    try {
      const withingsAddress = {
        name,
        company_name: "Alfie",
        email,
        telephone: phone,
        address1: address.line1,
        address2: address.line2,
        city: address.city,
        zip: address.postalCode,
        state: address.state,
        country: "US",
      }

      const testmode =
        process.env.NODE_ENV !== "production" ? TEST_MODE.SHIPPED : undefined

      const order = await this.withingsService.createOrder(
        user.id,
        withingsAddress,
        testmode
      )
      status = `${order.status}(Order id: ${order.order_id})`
      const message = `[WITHINGS][TIME: ${new Date().toString()}] ${name}(${email})`
      console.log(message)
      Sentry.captureEvent({
        message,
        level: "info",
      })
    } catch (err) {
      status = `${err.message}`
      const message = `[WITHINGS][TIME: ${new Date().toString()}] ${status}`
      console.log(message)
      Sentry.captureEvent({
        message,
        level: "error",
      })
    }

    if (signupPartnerProviderId) {
      const signupPartnerProvider = await SignupPartnerProviderModel.findById(
        signupPartnerProviderId
      )
      if (signupPartnerProvider.faxNumber) {
        // send fax
        const text = `
        Subject: Patient Referred to Alfie Health

        Hello,
        We have received a referal to Alfie Health for the following patient:
        ${name}
        ${dateOfBirth}

        Our records show this patient was referred by:
        ${signupPartnerProvider.title}
        ${signupPartnerProvider.npi}
        ${signupPartnerProvider.address}, ${signupPartnerProvider.city}, ${signupPartnerProvider.state} ${signupPartnerProvider.zipCode}
        
        Please reach out to us with any questions.
      `

        const payload = {
          faxNumber: signupPartnerProvider.faxNumber,
          pdfBuffer: new TextEncoder().encode(text),
        }
        this.faxService.sendFax(payload)
      }
    }

    const subject = "Withings Order Status"
    const text = `
      Name: ${name}
      Email: ${email}
      Phone Number: ${phone}
      Address: ${address.line1} ${address.line2}, ${address.city}, ${address.postalCode} ${address.state}
      Status: ${status}
    `
    await this.emailService.sendEmail(subject, text, ["patients@joinalfie.com"])

    console.log(`USER CREATED: ${user._id}`)

    return {
      message: userCreatedMessage,
      user,
    }
  }

  async subscribeEmail(input: SubscribeEmailInput) {
    input.email = input.email.toLowerCase()

    const { email, fullName, location, waitlist, currentMember } = input
    const { unknownError } = config.get("errors.subscribeEmail") as any
    const waitlistMessage = config.get("messages.subscribeEmail")
    const { emailSubscribersTable, waitlistTable } = config.get(
      "dynamoDb"
    ) as any

    try {
      const { $response } = await this.awsDynamo
        .getItem({
          TableName: !waitlist ? emailSubscribersTable : waitlistTable,
          Key: {
            emailaddress: {
              S: email,
            },
          },
        })
        .promise()

      if ($response.data && $response.data.Item && currentMember) {
        const { $response: $response2 } = await this.awsDynamo
          .deleteItem({
            TableName: !waitlist ? emailSubscribersTable : waitlistTable,
            Key: {
              emailaddress: {
                S: email,
              },
            },
          })
          .promise()

        if ($response2.error) {
          console.log(
            "An error occured deleting user from DynamoDB",
            $response2.error.message
          )
          throw new ApolloError(unknownError.message, unknownError.code)
        }

        return {
          message: waitlistMessage,
        }
      }

      const { $response: $response3 } = await this.awsDynamo
        .putItem({
          TableName: !waitlist ? emailSubscribersTable : waitlistTable,
          Item: {
            emailaddress: {
              S: email,
            },
            fullname: {
              S: fullName,
            },
            state: {
              S: location,
            },
          },
        })
        .promise()

      if ($response3.error) {
        console.log(
          "An error occured adding user to DynamoDB",
          $response3.error.message
        )
        throw new ApolloError(unknownError.message, unknownError.code)
      }

      return {
        message: waitlistMessage,
      }
    } catch (error) {
      captureException(error, "UserService.subscribeEmail", { input })
      throw new ApolloError(unknownError.message, unknownError.code)
    }
  }

  async forgotPassword(input: ForgotPasswordInput) {
    input.email = input.email.toLowerCase()

    const { email } = input
    const expirationInMinutes: number = config.get(
      "forgotPasswordExpirationInMinutes"
    )
    const { emailNotFound, emailSendError } = config.get(
      "errors.forgotPassword"
    ) as any
    const forgotPasswordMessage = config.get("messages.forgotPassword")

    // Get our user by email
    const dbUser = await UserModel.find().findByEmail(email)
    const dbProvider = !dbUser
      ? await ProviderModel.find().findByEmail(email).lean()
      : null
    const isProvider = dbProvider !== null

    const user = dbUser || dbProvider
    if (!user) {
      throw new ApolloError(emailNotFound.message, emailNotFound.code)
    }

    user.emailToken = uuidv4()
    user.emailTokenExpiresAt = addMinutes(new Date(), expirationInMinutes)

    if (!isProvider) {
      await UserModel.findByIdAndUpdate(user._id, user)
    } else {
      await ProviderModel.findByIdAndUpdate(user._id, user)
    }

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

    const dbUser = await UserModel.find().findByEmailToken(token)
    const dbProvider = dbUser
      ? null
      : await ProviderModel.find().findByEmailToken(token).lean()
    const isProvider = dbProvider !== null
    const user = dbUser || dbProvider

    if (!user) {
      throw new ApolloError(invalidToken.message, invalidToken.code)
    }

    if (!registration && user.emailTokenExpiresAt < new Date()) {
      throw new ApolloError(tokenExpired.message, tokenExpired.code)
    }

    user.emailToken = null
    user.emailTokenExpiresAt = null
    user.password = await this.hashPassword(password)

    if (isProvider) {
      await ProviderModel.findByIdAndUpdate(user._id, user)
    } else {
      await UserModel.findByIdAndUpdate(user._id, user)
    }

    const name = isProvider
      ? dbProvider.firstName + " " + dbProvider.lastName
      : dbUser.name
    const role = isProvider ? dbProvider.type : dbUser.role

    const userSummary = {
      _id: user._id,
      name,
      email: user.email,
      role,
    }

    // sign jwt
    const jwt = signJwt(userSummary, {
      expiresIn: config.get("jwtExpiration.normalExp"),
    })

    return {
      message: registration
        ? completedRegistrationMessage
        : resetPasswordMessage,
      token: jwt,
      user: userSummary,
    }
  }

  async hashPassword(password: string) {
    const salt = await bcrypt.genSalt(10)
    const hash = await bcrypt.hashSync(password, salt)
    return hash
  }

  async login(input: LoginInput) {
    input.email = input.email.toLowerCase()

    const { email, password, remember, noExpire } = input
    const { invalidCredentials, passwordNotCreated } = config.get(
      "errors.login"
    ) as any
    const { rememberExp, normalExp } = config.get("jwtExpiration") as any

    // Get our user by email
    const user: LeanDocument<User> = await UserModel.find().findByEmail(email)
    if (!user) {
      const provider = await ProviderModel.find().findByEmail(email).lean()
      if (!provider) {
        throw new ApolloError(
          invalidCredentials.message,
          invalidCredentials.code
        )
      }

      if (!provider.password) {
        throw new ApolloError(
          passwordNotCreated.message,
          passwordNotCreated.code
        )
      }

      const validPassword = await bcrypt.compare(password, provider.password)
      if (!validPassword) {
        throw new ApolloError(
          invalidCredentials.message,
          invalidCredentials.code
        )
      }

      if (noExpire && provider.role !== Role.Admin) {
        throw new ApolloError(
          invalidCredentials.message,
          invalidCredentials.code
        )
      }

      // sign jwt
      const jwt = signJwt(
        {
          _id: provider._id,
          name: provider.firstName + " " + provider.lastName,
          email: provider.email,
          role: provider.type,
        },
        {
          expiresIn: noExpire ? "1y" : remember ? rememberExp : normalExp,
        }
      )

      return {
        token: jwt,
        user: {
          _id: provider._id,
          name: provider.firstName + " " + provider.lastName,
          email: provider.email,
          role: provider.type,
          eaProviderId: provider.eaProviderId,
        },
      }
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
        ...(!noExpire
          ? { expiresIn: remember ? rememberExp : normalExp }
          : {
              expiresIn: "6000d",
            }),
      }
    )

    // return the jwt & user
    return {
      token,
      user,
    }
  }

  async getUser(userId: string) {
    try {
      const { notFound } = config.get("errors.user") as any
      const user = await UserModel.findById(userId)
        .populate<{
          provider: Provider
        }>("provider")
        .populate<{
          signupPartner: SignupPartner
        }>("signupPartner")
      if (!user) {
        throw new ApolloError(notFound.message, notFound.code)
      }
      return user
    } catch (error) {
      captureException(error, "UserService.getUser")
      throw new ApolloError(error.message, error.code ?? "ERROR")
    }
  }

  async getAllUsers() {
    try {
      // Find all users and populate the "provider" field
      const users = await UserModel.find({ role: Role.Patient })
        .populate<{
          provider: Provider
        }>("provider")
        .populate<{
          signupPartner: SignupPartner
        }>("signupPartner")

      return users
    } catch (error) {
      captureException(error, "UserService.getAllUsers")
      throw new ApolloError(error.message, error.code)
    }
  }

  async getAllUsersByAProvider(providerId: string) {
    try {
      const provider = await ProviderModel.findById(providerId)

      if (!provider) {
        const user = await UserModel.findById(providerId)
        const message = user
          ? `called getAllUsersByAProvider with a user ${user._id} instead of a provider`
          : `providerId ${providerId} not found`
        captureEvent(
          "warning",
          `UserService.getAllUsersByAProvider ${message}`,
          { providerId }
        )
        return []
      } else if (provider.type === Role.Doctor) {
        const results: LeanDocument<User[]> = await UserModel.find({
          state: { $in: provider.licensedStates },
          role: Role.Patient,
        }).populate<{ provider: Provider }>("provider")
        return results
      } else {
        const results: LeanDocument<User[]> = await UserModel.find({
          provider: providerId,
          role: Role.Patient,
        }).populate<{ provider: Provider }>("provider")

        return results
      }
    } catch (error) {
      captureException(error, "UserService.getAllUsersByAProvider")
      throw new ApolloError(error.message, error.code)
    }
  }

  async getAllUsersWithAlerts(providerId: string) {
    try {
      const provider = await ProviderModel.findById(providerId)
      let results

      if (!provider) {
        results = await AlertModel.find({
          acknowledgedAt: { $exists: false },
        }).populate("user")
      } else if (provider.type === Role.Doctor) {
        const providers = await ProviderModel.find({
          licensedStates: { $in: provider.licensedStates },
        }).select("_id")
        const providerIds = providers.map((p) => p._id)
        results = await AlertModel.find({
          acknowledgedAt: { $exists: false },
          provider: { $in: providerIds },
        }).populate("user")
      } else {
        results = await AlertModel.find({
          provider: providerId,
          acknowledgedAt: { $exists: false },
        }).populate("user")
      }

      return (
        results
          .map((alert: Alert) => alert.user)
          // Filter out duplicated patients
          .filter((value: User, index, self) => {
            return self.findIndex((v: User) => v._id === value._id) === index
          })
      )
    } catch (error) {
      captureException(error, "UserService.getAllUsersWithAlerts")
      throw new ApolloError(error.message, error.code)
    }
  }

  async getAllUsersByAHealthCoach() {
    try {
      // Find all users and populate the "provider" field
      const users = await UserModel.find({ role: Role.Patient }).populate<{
        provider: Provider
      }>("provider")

      return users
    } catch (error) {
      throw new ApolloError(error.message, error.code)
    }
  }

  async getAllPatients() {
    try {
      const users = await UserModel.find({
        role: Role.Patient,
      })

      return users
    } catch (error) {
      throw new ApolloError(error.message, error.code)
    }
  }

  async getLatestUserTaskPerUser(users: User[], tasks: Task[]) {
    const filteredUserTasks = []

    for (const user of users) {
      for (const task of tasks) {
        console.log(
          `[TASK JOB][USER: ${user._id}] Checking for usertasks for task: ${task._id}`
        )
        const userTask = await UserTaskModel.findOne({
          task: task._id,
          user: user._id,
        }).sort({ createdAt: -1 })

        if (userTask) {
          filteredUserTasks.push(userTask)
        }
      }
    }

    return filteredUserTasks
  }

  async taskJob() {
    try {
      const users = await this.getAllPatients()
      const tasks = await TaskModel.find({ interval: { $exists: true } })
      const allUserTasks = await this.getLatestUserTaskPerUser(users, tasks)

      const userTasksMap = new Map()
      allUserTasks.forEach((uTask) => {
        const userId = uTask.user.toString()
        if (!userTasksMap.has(userId)) {
          userTasksMap.set(userId, [])
        }
        userTasksMap.get(userId).push(uTask)
      })

      const allNewTasks: AllTaskEmail[] = []
      const allDueTodayTasks: AllTaskEmail[] = []
      const allPastDueTasks: AllTaskEmail[] = []
      const errors: string[] = []

      for (const user of users) {
        const userTasks = userTasksMap.get(user._id.toString()) || []

        const { newTasks, dueTodayTasks, pastDueTasks } =
          await this.processUserTasks(tasks, userTasks)

        allNewTasks.push(
          ...newTasks.map((task) => ({
            ...task,
            userId: user._id,
            userName: user.name,
            userEmail: user.email,
          }))
        )
        allDueTodayTasks.push(
          ...dueTodayTasks.map((task) => ({
            ...task,
            userId: user._id,
            userName: user.name,
            userEmail: user.email,
          }))
        )
        allPastDueTasks.push(
          ...pastDueTasks.map((task) => ({
            ...task,
            userId: user._id,
            userName: user.name,
            userEmail: user.email,
          }))
        )

        await this.sendNotifications(
          user,
          newTasks,
          dueTodayTasks,
          pastDueTasks,
          errors
        )
      }

      await this.sendReport(
        allNewTasks,
        allPastDueTasks,
        allDueTodayTasks,
        errors
      )
    } catch (error) {
      console.error("Error in taskJob:", error)
    }
  }

  async processUserTasks(tasks: any, userTasks: any[]) {
    const newTasks: TaskEmail[] = []
    const dueTodayTasks: TaskEmail[] = []
    const pastDueTasks: TaskEmail[] = []

    for (const task of tasks) {
      const uTask = userTasks.find(
        (userTask) => userTask.task.toString() === task._id.toString()
      )

      if (uTask) {
        if (uTask.completed) {
          const completedAt = new Date(uTask.completedAt).setHours(0, 0)
          const completedDate = addDays(completedAt, Number(task.interval))

          if (isPast(completedDate) || isToday(completedDate)) {
            const dueAt = addDays(
              new Date().setHours(0, 0),
              task.daysTillDue || 0
            )
            const dueAtFormatted = this.formatDueAt(dueAt)
            newTasks.push({
              taskName: task.name,
              dueAt,
              dueAtFormatted,
              taskId: task._id,
              userTaskId: uTask._id,
            })
          }
        } else {
          const dueAt = new Date(uTask.dueAt).setHours(0, 0)
          const shouldNotifyUserAt = addDays(
            new Date(uTask.lastNotifiedUserAt),
            3
          )
          if (isToday(dueAt) && isPast(shouldNotifyUserAt)) {
            dueTodayTasks.push({
              taskName: task.name,
              dueAt: uTask.dueAt,
              dueAtFormatted: this.formatDueAt(dueAt),
              taskId: task._id,
              userTaskId: uTask._id,
            })
          } else if (isPast(dueAt)) {
            const shouldNotifyPastDueUserAt = addDays(
              new Date(uTask.lastNotifiedUserPastDueAt),
              3
            )
            if (isPast(shouldNotifyPastDueUserAt)) {
              pastDueTasks.push({
                taskName: task.name,
                dueAt: uTask.dueAt,
                dueAtFormatted: this.formatDueAt(dueAt),
                taskId: task._id,
                userTaskId: uTask.id,
              })
            }
          }
        }
      } else if (
        task.type !== TaskType.SCHEDULE_APPOINTMENT ||
        task.type !== TaskType.SCHEDULE_HEALTH_COACH_APPOINTMENT
      ) {
        const dueAt = addDays(new Date().setHours(0, 0), task.daysTillDue || 0)
        const dueAtFormatted = this.formatDueAt(dueAt)
        newTasks.push({
          taskName: task.name,
          dueAt,
          dueAtFormatted,
          taskId: task._id,
        })
      }
    }

    return { newTasks, dueTodayTasks, pastDueTasks }
  }

  formatDueAt(dueAt: number | Date) {
    if (isToday(dueAt)) return "Today"
    if (isTomorrow(dueAt)) return "Tomorrow"
    if (isThisWeek(dueAt)) return format(dueAt, "EEE")
    return format(dueAt, "EEE, LLL do")
  }

  async sendNotifications(
    user: User,
    newTasks: TaskEmail[],
    dueTodayTasks: TaskEmail[],
    pastDueTasks: TaskEmail[],
    errors: any
  ) {
    if (
      newTasks.length > 0 ||
      pastDueTasks.length > 0 ||
      dueTodayTasks.length > 0
    ) {
      console.log(`[TASK JOB][USER: ${user._id}]Sending notifications...`)

      // first assign tasks

      if (newTasks.length > 0) {
        const newUserTasks = await UserTaskModel.insertMany(
          newTasks.map((t: TaskEmail) => ({
            task: t.taskId,
            user: user._id,
            completed: false,
            dueAt: t.dueAt,
            lastNotifiedUserAt: new Date(),
          }))
        )
        console.log(
          `[TASK JOB][USER: ${user._id}] ${newUserTasks.length} New Tasks Assigned!`
        )
      }

      if (dueTodayTasks.length > 0) {
        const time = addDays(new Date().setHours(0, 0), 0)
        const updatedDueTodayTasks = await UserTaskModel.updateMany(
          { _id: { $in: dueTodayTasks.map((t: any) => t.taskId) } },
          {
            lastNotifiedUserAt: time,
            updatedAt: time,
          }
        )
        console.log(
          `[TASK JOB][USER: ${user._id}] ${updatedDueTodayTasks.modifiedCount} Due Today Tasks Updated!`
        )
      }

      if (pastDueTasks.length > 0) {
        const time = addDays(new Date().setHours(0, 0), 0)
        const updatedPastDueTasks = await UserTaskModel.updateMany(
          { _id: { $in: pastDueTasks.map((t: any) => t.taskId) } },
          {
            lastNotifiedUserPastDueAt: time,
            updatedAt: time,
          }
        )
        console.log(
          `[TASK JOB][USER: ${user._id}] ${updatedPastDueTasks.modifiedCount} Past Due Tasks Updated!`
        )
      }

      const emailSent = await this.sendTaskEmail({
        name: user.name,
        email: user.email,
        newTasks,
        pastDueTasks,
        dueTodayTasks,
      })

      if (!emailSent) {
        errors.push(
          `Error sending task email to user (${user._id}): ${user.email}`
        )
      }

      const smsSent = await this.smsService.sendTaskSms({
        name: user.name,
        phone: user.phone,
        newTasks,
        pastDueTasks,
        dueTodayTasks,
        timezone: user.timezone,
      })

      if (!smsSent.sid) {
        errors.push(
          `Error sending task SMS to user (${user._id}): ${user.email}, ${user.phone}`
        )
      }
    }
  }
  async sendReport(
    allNewTasks: any,
    allPastDueTasks: any,
    allDueTodayTasks: any,
    errors: any
  ) {
    if (
      allNewTasks.length > 0 ||
      allPastDueTasks.length > 0 ||
      allDueTodayTasks.length > 0
    ) {
      const reportSent = await this.sendTaskReport({
        allNewTasks,
        allPastDueTasks,
        allDueTodayTasks,
        errors,
      })

      if (!reportSent) {
        captureEvent("error", "Error sending the daily task report.")
      } else {
        console.log("Daily task report email has been successfully sent")
      }
    }
  }
  async getAllUserTasksByUser(userId: string) {
    try {
      const userTasks = await UserTaskModel.find({ user: userId }).populate<{
        task: Task
      }>("task")

      return userTasks
    } catch (error) {
      captureException(error, "UserService.getAllUserTasksByUser")
      throw new ApolloError("Error retrieving user tasks for user.", "ERROR")
    }
  }

  async completeCheckout(
    stripeSubscriptionId: string,
    subscriptionExpiresAt: Date
  ) {
    const { checkoutCompleted } = config.get("messages") as any
    const { notFound, alreadyCheckedOut } = config.get("errors.checkout") as any

    const checkout = await CheckoutModel.find().findByStripeSubscriptionId(
      stripeSubscriptionId
    )

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

    const existingUser = await UserModel.find().findByEmail(checkout.email)
    let user
    if (existingUser) {
      // update existing user
      const { user: updatedUser } = await this.updateUser({
        userId: existingUser._id,
        subscriptionExpiresAt: expiresAt,
        stripeSubscriptionId,
        stripeCustomerId: checkout.stripeCustomerId,
      })

      checkout.user = updatedUser._id
      user = updatedUser
    } else {
      const { user: newUser } = await this.createUser({
        name: checkout.name,
        email: checkout.email,
        phone: checkout.phone,
        dateOfBirth: checkout.dateOfBirth,
        address: checkout.shippingAddress,
        gender: checkout.gender,
        weightInLbs: checkout.weightInLbs,
        heightInInches: checkout.heightInInches,
        stripeCustomerId: checkout.stripeCustomerId,
        subscriptionExpiresAt: expiresAt,
        stripeSubscriptionId,
        textOptIn: checkout.textOptIn,
        signupPartnerId: checkout.signupPartner.toString(),
        signupPartnerProviderId: checkout.signupPartnerProvider.toString(),
      })
      checkout.user = newUser._id
      user = newUser
    }

    checkout.checkedOut = true
    await checkout.save()

    if (process.env.NODE_ENV === "production") {
      postHogClient.capture({
        distinctId: checkout._id,
        event: "Checkout Complete",
        properties: {
          referrer: checkout.referrer || "None",
          checkoutId: checkout._id,
          userId: user._id,
          signupPartner: checkout.signupPartner || "None",
          signupPartnerProvider: checkout.signupPartnerProvider || "None",
          insurancePay: false,
          environment: process.env.NODE_ENV,
        },
      })
    }

    return {
      message: checkoutCompleted,
      user,
    }
  }

  async getCheckout(checkoutId: string) {
    const { checkoutNotFound, alreadyCheckedOut } = config.get(
      "errors.checkout"
    ) as any

    const checkout: LeanDocument<Checkout> = await CheckoutModel.findById(
      checkoutId
    )
    if (!checkout) {
      throw new ApolloError(checkoutNotFound.message, checkoutNotFound.code)
    }

    if (checkout.checkedOut) {
      throw new ApolloError(alreadyCheckedOut.message, alreadyCheckedOut.code)
    }

    return {
      checkout,
    }
  }

  async createStripeCheckoutSession({
    _id,
    shipping,
    billing,
    sameAsShipping,
  }: CheckoutAddressInput) {
    const { checkoutNotFound, alreadyCheckedOut } = config.get(
      "errors.checkout"
    ) as any

    const checkout = await CheckoutModel.findById(_id)

    if (!checkout) {
      throw new ApolloError(checkoutNotFound.message, checkoutNotFound.code)
    }

    if (checkout.checkedOut) {
      throw new ApolloError(alreadyCheckedOut.message, alreadyCheckedOut.code)
    }

    // check for existing customer
    const existingCustomer = await this.stripeService.stripeSdk.customers.list({
      email: checkout.email,
    })

    // vars to add stripe details to
    let customer
    let setupIntent

    const stripeShipping = {
      line1: shipping.line1,
      line2: shipping.line2,
      city: shipping.city,
      state: shipping.state,
      postal_code: shipping.postalCode,
    }

    // if customer exists update info
    if (existingCustomer.data.length !== 0) {
      customer = existingCustomer.data[0]

      // update with latest checkout info
      await this.stripeService.stripeSdk.customers.update(customer.id, {
        address: stripeShipping,
        phone: checkout.phone,
        name: checkout.name,
        email: checkout.email,
      })
    }

    if (checkout.stripeSetupIntentId) {
      setupIntent = await this.stripeService.stripeSdk.setupIntents.retrieve(
        checkout.stripeSetupIntentId
      )
    }

    // payment intent details
    const setupIntentDetails: stripe.SetupIntentCreateParams = {
      description: "Alfie Setup Intent",
      usage: "off_session",
      metadata: {
        checkoutId: String(checkout._id),
        email: checkout.email,
        INSURANCE: `${
          checkout.insurance &&
          checkout.insurance.status !== InsuranceStatus.NOT_ACTIVE
            ? "TRUE"
            : "FALSE"
        }`,
      },
      ...(customer && { customer: customer.id }),
    }

    try {
      // create payment intent
      if (
        setupIntent &&
        !["canceled", "requires_payment_method"].includes(setupIntent.status)
      ) {
        setupIntent = await this.stripeService.stripeSdk.setupIntents.update(
          setupIntent.id,
          {
            ...setupIntentDetails,
          }
        )
      } else {
        setupIntent = await this.stripeService.stripeSdk.setupIntents.create({
          ...setupIntentDetails,
        })
      }
    } catch (err) {
      throw new ApolloError("Setting up stripe intent failed!")
    }

    // update checkout with stripe info
    checkout.stripeSetupIntentId = setupIntent.id
    checkout.stripeClientSecret = setupIntent.client_secret
    checkout.shippingAddress = shipping
    checkout.billingAddress = sameAsShipping ? shipping : billing
    if (customer) checkout.stripeCustomerId = customer.id
    await checkout.save()

    return {
      checkout,
    }
  }

  async createInsuredUserFromCheckout({
    _id,
    shipping,
    billing,
    sameAsShipping,
  }: CheckoutAddressInput) {
    const { checkoutNotFound } = config.get("errors.checkout") as any

    const checkout = await CheckoutModel.findById(_id)

    if (!checkout) {
      throw new ApolloError(checkoutNotFound.message, checkoutNotFound.code)
    }

    if (
      checkout.insurance &&
      checkout.insurance.status === InsuranceStatus.NOT_ACTIVE
    ) {
      throw new ApolloError("Insurance not covered!")
    }

    checkout.shippingAddress = shipping
    checkout.billingAddress = sameAsShipping ? shipping : billing
    await checkout.save()

    let insurance
    if (
      checkout.insurance &&
      checkout.insurance?.status !== InsuranceStatus.NOT_ACTIVE
    ) {
      insurance = {
        ...checkout.insurance,
        insuranceId: checkout.insurance.insurance.toString(),
      }
      delete insurance.insurance
    }

    const userInput = {
      name: checkout.name,
      textOptIn: checkout.textOptIn,
      email: checkout.email,
      phone: checkout.phone,
      dateOfBirth: checkout.dateOfBirth,
      address: checkout.shippingAddress,
      weightInLbs: checkout.weightInLbs,
      gender: checkout.gender,
      heightInInches: checkout.heightInInches,
      ...(checkout.provider && { providerId: checkout.provider.toString() }),
      ...(insurance && { insurance }),
      signupPartnerId: checkout.signupPartner?.toString(),
      signupPartnerProviderId: checkout.signupPartnerProvider?.toString(),
    }
    const { user } = await this.createUser(userInput)

    if (process.env.NODE_ENV === "production") {
      postHogClient.capture({
        distinctId: checkout._id,
        event: "Checkout Complete",
        properties: {
          referrer: checkout.referrer || "None",
          checkoutId: checkout._id,
          userId: user._id,
          signupPartner: checkout.signupPartner || "None",
          signupPartnerProvider: checkout.signupPartnerProvider || "None",
          insurancePay:
            checkout.insurance &&
            checkout.insurance.status !== InsuranceStatus.NOT_ACTIVE
              ? true
              : false,
          environment: process.env.NODE_ENV,
        },
      })
    }

    return {
      checkout,
    }
  }

  async createOrFindCheckout(input: CreateCheckoutInput) {
    input.email = input.email.toLowerCase()

    try {
      const { checkoutFound, checkoutCreated } = config.get("messages") as any
      const { alreadyCheckedOut } = config.get("errors.checkout") as any
      const { emailSubscribersTable } = config.get("dynamoDb") as any

      const {
        name,
        email,
        dateOfBirth,
        gender,
        state,
        heightInInches,
        weightInLbs,
        textOptIn,
        phone,
        pastTries,
        weightLossMotivatorV2,
        signupPartnerId,
        signupPartnerProviderId,
        referrer,
      } = input

      const checkout = await CheckoutModel.find().findByEmail(email)
      if (checkout) {
        // check if already checked out
        if (checkout.checkedOut) {
          throw new ApolloError(
            alreadyCheckedOut.message,
            alreadyCheckedOut.code
          )
        }

        // update values
        checkout.name = name
        checkout.weightLossMotivatorV2 = weightLossMotivatorV2
        checkout.dateOfBirth = dateOfBirth
        checkout.gender = gender
        checkout.state = state
        checkout.heightInInches = heightInInches
        checkout.weightInLbs = weightInLbs
        checkout.textOptIn = textOptIn
        checkout.phone = phone
        checkout.pastTries = pastTries
        checkout.signupPartner = signupPartnerId
        checkout.signupPartnerProvider = signupPartnerProviderId
        checkout.referrer = referrer

        // update in db
        await CheckoutModel.findByIdAndUpdate(checkout._id, checkout)

        // return updated checkout
        return {
          message: checkoutFound,
          checkout,
        }
      }

      // send to email subscriber lambda
      const { $response } = await this.awsDynamo
        .putItem({
          TableName: emailSubscribersTable,
          Item: {
            emailaddress: { S: email },
            fullname: { S: name },
            state: { S: state },
          },
        })
        .promise()

      if ($response.error) {
        console.log(
          "An error occured creating entry in dynamodb",
          $response.error.message
        )
      }

      // create new checkout
      const newCheckout = await CheckoutModel.create({
        name,
        email,
        weightLossMotivatorV2,
        dateOfBirth,
        gender,
        state,
        heightInInches,
        weightInLbs,
        textOptIn,
        phone,
        pastTries,
        signupPartner: signupPartnerId,
        signupPartnerProvider: signupPartnerProviderId,
        referrer,
      })

      if (process.env.NODE_ENV === "production") {
        postHogClient.capture({
          distinctId: newCheckout._id,
          event: "Checkout Started",
          properties: {
            referrer: newCheckout.referrer || "None",
            checkoutId: newCheckout._id,
            signupPartner: newCheckout.signupPartner || "None",
            signupPartnerProvider: newCheckout.signupPartnerProvider || "None",
            insurancePay:
              newCheckout.insurance &&
              newCheckout.insurance.status !== InsuranceStatus.NOT_ACTIVE
                ? true
                : false,
            environment: process.env.NODE_ENV,
          },
        })
      }

      // return new checkout
      return {
        message: checkoutCreated,
        checkout: newCheckout,
      }
    } catch (error) {
      captureException(error, "UserService.createOrFindCheckout", { input })
    }
  }

  findTwoMostRecentWeights(weights: any[]): [any | null, any | null] {
    const today = new Date()
    let mostRecentEntry: any | null = null
    let secondMostRecentEntry: any | null = null

    weights.forEach((entry) => {
      const entryDate = new Date(entry.date)
      if (entryDate <= today) {
        if (mostRecentEntry === null || entryDate > mostRecentEntry.date) {
          secondMostRecentEntry = mostRecentEntry
          mostRecentEntry = entry
        } else if (
          secondMostRecentEntry === null ||
          entryDate > secondMostRecentEntry.date
        ) {
          secondMostRecentEntry = entry
        }
      }
    })

    return [mostRecentEntry, secondMostRecentEntry]
  }

  removeDuplicates(subTypes: any[]): any[] {
    const uniqueSubTypesSet = new Set<string>()
    const uniqueSubTypes: any[] = []

    subTypes.forEach((subType) => {
      const subTypeJSON = JSON.stringify(subType)
      if (!uniqueSubTypesSet.has(subTypeJSON)) {
        uniqueSubTypesSet.add(subTypeJSON)
        uniqueSubTypes.push(subType)
      }
    })

    return uniqueSubTypes
  }

  async generateProtocolSummary(userId: string) {
    try {
      const configuration = new Configuration({
        apiKey: process.env.OPEN_AI_KEY,
      })
      const openAi = new OpenAIApi(configuration)
      const user = await UserModel.findById(userId)
      const allUserTasks = await UserTaskModel.find({ user: userId })

      // the userTasks array of objects only has the task id, so we needto find the actual task type in order to group each task by type the task type lives on the TaskModel.
      const findAndGroupTasks = async (userTasks: any) => {
        const tasks = await Promise.all(
          userTasks.map(async (task: any) => {
            const taskType = await TaskModel.findById(task.task)
            return { taskType: taskType.type, task: task }
          })
        )

        const groupedTasks = tasks.reduce((acc: any, task: any) => {
          const key = task.taskType
          if (!acc[key]) {
            acc[key] = { mostRecent: task, secondMostRecent: null }
          } else {
            if (
              new Date(task.task.completedAt) >
              new Date(acc[key].mostRecent.task.completedAt)
            ) {
              acc[key].secondMostRecent = acc[key].mostRecent
              acc[key].mostRecent = task
            } else if (
              acc[key].secondMostRecent === null ||
              new Date(task.task.completedAt) >
                new Date(acc[key].secondMostRecent.task.completedAt)
            ) {
              acc[key].secondMostRecent = task
            }
          }
          return acc
        }, {})

        return groupedTasks
      }
      const groupedTasks = await findAndGroupTasks(allUserTasks)

      const subTypes = this.removeDuplicates(user?.classifications)
      const weights = groupedTasks.WEIGHT_LOG
      let weightChange = null
      let firstWeight = null

      if (weights && weights.mostRecent) {
        const weight1 = parseFloat(
          weights.mostRecent.task.answers.find(
            (answer: any) => answer.key === "weight"
          )?.value
        )

        if (weights.secondMostRecent) {
          const weight2 = parseFloat(
            weights.secondMostRecent.task.answers.find(
              (answer: any) => answer.key === "weight"
            )?.value
          )

          weightChange =
            weight1 && weight2
              ? (((weight1 - weight2) / weight2) * 100).toFixed(2)
              : null
        } else {
          firstWeight = weight1
        }
      }

      // ... (rest of the code remains unchanged)

      const weightInfo = weightChange
        ? `They have lost ${weightChange}% over the past 4 weeks`
        : firstWeight
        ? `Their current weight is ${firstWeight}`
        : ""

      const medicationsFromAkute =
        await this.akuteService.getASinglePatientMedications(
          user?.akutePatientId
        )

      let activeMedications = []
      if (Array.isArray(medicationsFromAkute)) {
        activeMedications = medicationsFromAkute.filter(
          (medication: any) => medication.status === "active"
        )
      }
      // Updated code to extract medication name and dose
      const medicationsAndStrength = activeMedications.map(
        (medication: any) => {
          const medicationName = medication.generic_name
          const medicationStrength = medication.strength
          return `${medicationName} ${medicationStrength}`
        }
      )
      const medications = medicationsAndStrength.join(", ")

      const subTypesText = subTypes
        .map((subtype, index) => {
          const classification = subtype.classification
          const percentile = subtype.percentile
          return `Classification ${
            index + 1
          }: ${classification} (${percentile}%)`
        })
        .join(", ")

      const prompt = `This Patient has the following classifications and percentiles: ${subTypesText}. ${weightInfo} and are currently on this or these doses of medication: ${medications} `
      console.log(prompt, "prompt")
      const params = {
        model: "gpt-4",
        temperature: 0,
        messages: [
          {
            role: ChatCompletionRequestMessageRoleEnum.System,
            content: `
            Your task is to create a recommendation for the patient. You will receive the current metabolic profile percentiles for the patient as well as current prescriptions the patient is taking outside of our program, and through our program. Your recommendation should follow the following format: 
            Medication recommendation: 
            <Include the recommendation for the patient around medications based on their profile here>            
            Non-AOM recommendation: 
            <Include the recommendation for medication switches by PCP or other based on the patients current medications and if they are weight-gain causing or weight-loss causing>            
            Diet Recommendations
            <Include the recommendation for the patient around diet based on their profile here>            
            Exercise Recommendations
            <Include some exercise suggestions here>             
            Sleep Recommendations
            <Include some sleep suggestions here>
            `,
          },
          {
            role: ChatCompletionRequestMessageRoleEnum.User,
            content: `Protocol: ${protocol} question: ${prompt}`,
          },
        ],
      }
      const completion = await openAi.createChatCompletion(params, {
        headers: {
          "OpenAI-Organization": "org-QoMwwdaIbJ7OUvpSZmPZ42Y4",
        },
      })
      console.log(completion.data.choices[0].message.content, "completion")
      user.generatedSummary = completion.data.choices[0].message.content
      user.save()
      return user
      // res.send(completion.data.choices[0].message.content)
    } catch (error) {
      console.log(error, "ERROR")
      return error
    }
  }

  async sendbirdChannels(userId: string) {
    try {
      const channels = await getSendBirdUserChannels(userId)
      console.log(channels)
      return channels
    } catch (error) {
      captureException(error, "UserService.sendbirdChannels")
    }
  }

  /** Completes an upload by saving the files uploaded to S3 to the database. */
  async completeUpload(input: File[], userId: string): Promise<User> {
    const { notFound } = config.get("errors.user") as any
    const user = await UserModel.findById(userId).populate<{
      provider: Provider
    }>("provider")
    if (!user) {
      throw new ApolloError(notFound.message, notFound.code)
    }
    const update = await UserModel.findOneAndUpdate(
      { _id: userId },
      { $push: { files: { $each: input } } },
      { new: true }
    )

    return update
  }

  /** Updates insurance information for a given user. */
  async updateInsurance(user: User, input: InsuranceDetails): Promise<void> {
    try {
      user.insurance = input
      await this.akuteService.createInsurance(
        user.akutePatientId,
        user.insurance
      )
      await UserModel.findByIdAndUpdate(user._id, user)
    } catch (error) {
      captureException(error, "UserService.updateInsurance", {
        insurance: input,
      })
    }
  }

  /**
   * Complete withings scale connect task on device connected event
   */
  async processWithingsScaleConnected(metriportUserId: string) {
    const user = await UserModel.findOne({ metriportUserId }).populate<{
      provider: Provider
    }>("provider")

    if (!user) {
      const message = `[METRIPORT][TIME: ${new Date().toString()}] User not found for metriport ID: ${metriportUserId}`
      console.log(message)
      Sentry.captureEvent({
        message,
        level: "warning",
      })
      return
    }

    user.hasScale = true
    await user.save()

    const task = await TaskModel.findOne({
      type: TaskType.CONNECT_WITHINGS_SCALE,
    })

    const incompleteUserTask = await UserTaskModel.findOne({
      user: user._id,
      task: task._id,
      completed: false,
    })
    if (incompleteUserTask) {
      await this.taskService.completeUserTask({
        _id: incompleteUserTask._id.toString(),
      })
    }
  }

  /**
   * Record a withings scale reading and process insurance.
   */
  async processWithingsScaleReading(
    metriportUserId: string,
    weightLbs: number,
    time?: Date
  ): Promise<{ user: User; userTask: UserTask }> {
    let user = await UserModel.findOne({ metriportUserId }).populate<{
      provider: Provider
    }>("provider")

    if (!user) {
      const message = `[METRIPORT][TIME: ${new Date().toString()}] User not found for metriport ID: ${metriportUserId}`
      console.log(message)
      Sentry.captureEvent({
        message,
        level: "warning",
      })
      return
    }

    const weightLogTask = await TaskModel.findOne({ type: TaskType.WEIGHT_LOG })
    const weightLogUserTask = await UserTaskModel.findOne({
      task: weightLogTask._id,
      user: user._id,
      completed: false,
    })

    const userAnswer: UserNumberAnswer = {
      key: "scaleWeight",
      value: weightLbs,
      type: AnswerType.NUMBER,
    }

    // Directly create and complete the user task
    let userTask
    if (weightLogUserTask) {
      weightLogUserTask.answers = [userAnswer]
      weightLogUserTask.completed = true
      if (time) {
        weightLogUserTask.completedAt = new Date()
      } else {
        weightLogUserTask.completedAt = new Date()
      }
      await weightLogUserTask.save()
      const message = `[METRIPORT][TIME: ${new Date().toString()}] Successfully updated weight task for user: ${
        user._id
      } - ${weightLbs}lbs - ${weightLogUserTask._id}`
      console.log(message)
      Sentry.captureMessage(message)
    } else {
      userTask = await UserTaskModel.create({
        user: user._id,
        task: weightLogTask._id,
        answers: [userAnswer],
        completed: true,
        completedAt: new Date(),
      })
      const message = `[METRIPORT][TIME: ${new Date().toString()}] Successfully created weight task for user: ${
        user._id
      } - ${weightLbs}lbs - ${userTask._id}`
      console.log(message)
      Sentry.captureMessage(message)
    }
    // Save to user weights array as well so push onto array
    user.weights.push({
      value: weightLbs,
      date: time ? new Date(time) : new Date(),
      scale: true,
    })
    // recalculate bmi
    const bmi = calculateBMI(weightLbs, user.heightInInches)
    user.bmi = bmi
    await user.save()
    const message = `[METRIPORT][TIME: ${new Date().toString()}] Successfully updated weight for user: ${
      user._id
    } - ${weightLbs}lbs`
    console.log(message)
    Sentry.captureMessage(message)

    // if not a cash pay user, bill for first measurement, and 16th measurement in month
    if (!user.stripeSubscriptionId) {
      console.log(
        `UserService.processWithingsScaleReading: Creating coded encounter for user ${user._id}`
      )
      user = await UserModel.findById(user._id).populate<{
        provider: Provider
      }>("provider")

      const result = await this.candidService.createCodedEncounterForScaleEvent(
        user,
        user.provider,
        user.weights
      )

      if (result === null) {
        console.log(
          " * Scale event did not meet criteria for insurance billing."
        )
      }
    } else {
      console.log(
        "UserService.processWithingsScaleReading: No insurance processing for scale event, user has stripe subscription."
      )
    }

    return { user, userTask }
  }

  async createUserFromCheckout(checkoutId: string) {
    // create new user
    try {
      const pICheckout = await CheckoutModel.findOne({
        _id: checkoutId,
      })

      if (!pICheckout) {
        throw new Error(
          `Checkout not found for stripe customer id: ${checkoutId}`
        )
      }

      try {
        let insurance
        let providerId
        if (
          pICheckout.insurance &&
          pICheckout.insurance?.status !== InsuranceStatus.NOT_ACTIVE
        ) {
          insurance = {
            ...pICheckout.insurance,
            insuranceId: pICheckout.insurance.insurance.toString(),
          }
          providerId = pICheckout.provider.toString()
          delete insurance.insurance
        }

        const pINewUser = await this.createUser({
          name: pICheckout.name,
          textOptIn: pICheckout.textOptIn,
          email: pICheckout.email,
          phone: pICheckout.phone,
          dateOfBirth: pICheckout.dateOfBirth,
          address: pICheckout.shippingAddress,
          weightInLbs: pICheckout.weightInLbs,
          gender: pICheckout.gender,
          heightInInches: pICheckout.heightInInches,
          stripeCustomerId: checkoutId,
          stripePaymentIntentId: null,
          stripeSubscriptionId: null,
          ...(providerId && { providerId }),
          ...(insurance && { insurance }),
          signupPartnerId: pICheckout.signupPartner?.toString(),
          signupPartnerProviderId: pICheckout.signupPartnerProvider?.toString(),
        })

        const newUser = pINewUser.user

        if (process.env.NODE_ENV === "production") {
          postHogClient.capture({
            distinctId: pICheckout._id,
            event: "Checkout Complete",
            properties: {
              referrer: pICheckout.referrer || "None",
              checkoutId: pICheckout._id,
              userId: newUser._id,
              signupPartner: pICheckout.signupPartner || "None",
              signupPartnerProvider: pICheckout.signupPartnerProvider || "None",
              insurancePay:
                pICheckout.insurance &&
                pICheckout.insurance.status !== InsuranceStatus.NOT_ACTIVE
                  ? true
                  : false,
              environment: process.env.NODE_ENV,
            },
          })
        }

        await this.stripeService.stripeSdk.customers.update(
          pICheckout.stripeCustomerId,
          {
            metadata: {
              USER_ID: newUser._id,
              UPDATED_VIA_STRIPE_WEBHOOK_ON: new Date().toString(),
            },
          }
        )

        pICheckout.user = newUser._id
        pICheckout.checkedOut = true
        await pICheckout.save()

        return newUser._id.toString()
      } catch (err) {
        // error occured creating new user
        console.log(err)
        return `Error creating user for checkout id: ${checkoutId}`
      }
    } catch (err) {
      return `Checkout not found for checkout id: ${checkoutId}`
    }
  }

  async transferPatients(oldProviderId: string, newProviderId: string) {
    // Find providers
    const providers: Provider[] = await ProviderModel.find({
      _id: {
        $in: [oldProviderId, newProviderId],
      },
    })

    if (providers?.length !== 2) {
      throw new Error("Error: Not existing providers.")
    }

    const oldProvider = providers.find(
      (p) => p._id.toString() === oldProviderId
    )
    const newProvider = providers.find(
      (p) => p._id.toString() === newProviderId
    )

    // Validate the licensed state of two providers
    if (
      !oldProvider.licensedStates.every((state) =>
        newProvider.licensedStates.includes(state)
      )
    ) {
      throw new Error("Error: Providers must licensed in same state.")
    }

    // Pull old provider patients
    const patients = await UserModel.find({
      provider: oldProviderId,
      role: Role.Patient,
    })

    // Validate Sendbird User existence for the providers
    for (const provider of providers) {
      const sendbirdUser = await findSendBirdUser(provider._id.toString())
      if (!sendbirdUser) {
        const user_id = await createSendBirdUser({
          user_id: provider._id.toString(),
          nickname: `${provider.firstName} ${provider.lastName}`,
          profile_url: "",
          profile_file: "",
        })

        console.log(`Sendbird user has created for provider ${user_id}`)
      }
    }

    const records = []
    // Remove provider from the patient sendbird channel
    for (const patient of patients) {
      const channels = await getSendBirdUserChannels(patient._id.toString())
      if (!channels.length) {
        console.log(
          "Skipping patient - No Sendbird channel:",
          patient._id.toString()
        )
        continue
      }

      for (const channel of channels) {
        await leaveUserFromChannel(channel.channel_url, [
          oldProvider._id.toString(),
        ])
        await inviteUserToChannel({
          channel_url: channel.channel_url,
          user_id: null,
          provider_id: newProvider._id.toString(),
          autoInvite: false,
        })

        // Reassign the patient to new provider
        patient.provider = newProviderId.toString()
        await patient.save()

        records.push({
          oldProvider: oldProviderId,
          newProvider: newProviderId,
          channel: channel.channel_url,
          patient: patient.name,
        })
      }
    }

    // Export a report
    if (records.length > 0) {
      const csvWriter = createObjectCsvWriter({
        path: `${Date.now()}-sendbird-invite-fixer-report.csv`,
        header: [
          { id: "oldProvider", title: "Old Provider" },
          { id: "newProvider", title: "New Provider" },
          { id: "patient", title: "Patient" },
          { id: "channel", title: "Sendbird Channel" },
        ],
      })

      await csvWriter.writeRecords(records)

      console.log("Transfer report is ready!")
    }
  }
}

export default UserService

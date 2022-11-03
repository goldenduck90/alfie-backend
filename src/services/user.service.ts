import * as AWS from "aws-sdk"
import { ApolloError } from "apollo-server-errors"
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
import { TaskType } from "../schema/task.schema"
import ProviderService from "./provider.service"
import AkuteService from "./akute.service"
import AppointmentService from "./appointment.service"
import { ProviderModel } from "../schema/provider.schema"

class UserService extends EmailService {
  private taskService: TaskService
  private providerService: ProviderService
  private akuteService: AkuteService
  private appointmentService: AppointmentService
  public awsDynamo: AWS.DynamoDB

  constructor() {
    super()
    this.taskService = new TaskService()
    this.providerService = new ProviderService()
    this.akuteService = new AkuteService()
    this.appointmentService = new AppointmentService()
    this.awsDynamo = new AWS.DynamoDB({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION,
    })
  }

  async assignUserTasks(userId: string, taskTypes: TaskType[]) {
    const input = {
      userId,
      taskTypes,
    }
    this.taskService.bulkAssignTasksToUser(input)
  }

  async createUser(input: CreateUserInput, manual = false) {
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
      providerId,
      textOptIn,
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

    const patientId = await this.akuteService.createPatient({
      firstName: name.split(" ")[0],
      lastName: name.split(" ")[1],
      email,
      phone,
      dateOfBirth,
      address,
      sex: gender,
    })
    if (!patientId) {
      throw new ApolloError(
        `An error occured for creating a patient entry in Akute for: ${email}`,
        "INTERNAL_SERVER_ERROR"
      )
    }

    const customerId = await this.appointmentService.createCustomer({
      userId: "",
      firstName: name.split(" ")[0] || "",
      lastName: name.split(" ")[1] || "",
      email,
      phone,
      address: `${address.line1} ${address.line2 || ""}`,
      city: address.city,
      zipCode: address.postalCode,
      state: address.state,
      updateUser: false,
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
      eaCustomerId: customerId,
      akutePatientId: patientId,
      provider: provider._id,
      textOptIn,
    })
    if (!user) {
      throw new ApolloError(unknownError.message, unknownError.code)
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
    await triggerEntireSendBirdFlow(user._id, user.name, "", "")

    // assign initial tasks to user
    const tasks = [
      TaskType.ID_AND_INSURANCE_UPLOAD,
      TaskType.NEW_PATIENT_INTAKE_FORM,
      TaskType.MP_HUNGER,
      TaskType.MP_FEELING,
      TaskType.BP_LOG,
      TaskType.WEIGHT_LOG,
      TaskType.WAIST_LOG,
      TaskType.MP_BLUE_CAPSULE,
      TaskType.MP_ACTIVITY,
      TaskType.FOOD_LOG,
    ]
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
      console.log(error)
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
      const provider = await ProviderModel.find().findByEmail(email).lean()
      if (!provider) {
        throw new ApolloError(emailNotFound.message, emailNotFound.code)
      }

      // set resetPasswordToken & resetPasswordTokenExpiresAt
      provider.emailToken = uuidv4()
      provider.emailTokenExpiresAt = addMinutes(new Date(), expirationInMinutes)

      await ProviderModel.findByIdAndUpdate(provider._id, provider)

      const sent = await this.sendForgotPasswordEmail({
        email,
        token: provider.emailToken,
        provider: true,
      })

      if (!sent) {
        throw new ApolloError(emailSendError.message, emailSendError.code)
      }

      return { message: forgotPasswordMessage }
    }

    // set resetPasswordToken & resetPasswordTokenExpiresAt
    user.emailToken = uuidv4()
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
    const { token, password, registration, provider } = input
    const { invalidToken, tokenExpired } = config.get(
      "errors.resetPassword"
    ) as any
    const resetPasswordMessage = config.get("messages.resetPassword")
    const completedRegistrationMessage = config.get(
      "messages.completedRegistration"
    )

    if (provider) {
      const dbProvider = await ProviderModel.find()
        .findByEmailToken(token)
        .lean()
      if (!dbProvider) {
        throw new ApolloError(invalidToken.message, invalidToken.code)
      }

      if (!registration && dbProvider.emailTokenExpiresAt < new Date()) {
        throw new ApolloError(tokenExpired.message, tokenExpired.code)
      }

      dbProvider.emailToken = null
      dbProvider.emailTokenExpiresAt = null
      dbProvider.password = await this.hashPassword(password)

      await ProviderModel.findByIdAndUpdate(dbProvider._id, dbProvider)

      // sign jwt
      const jwt = signJwt(
        {
          _id: dbProvider._id,
          name: dbProvider.firstName + " " + dbProvider.lastName,
          email: dbProvider.email,
          role: dbProvider.type,
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
        user: {
          _id: dbProvider._id,
          name: dbProvider.firstName + " " + dbProvider.lastName,
          email: dbProvider.email,
          role: dbProvider.type,
        },
      }
    } else {
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
    const { notFound } = config.get("errors.user") as any
    const user = await UserModel.findById(userId).populate("provider")

    if (!user) {
      throw new ApolloError(notFound.message, notFound.code)
    }

    return user
  }

  async getAllUsers() {
    try {
      const users = await UserModel.find().populate("provider").lean()
      return users
    } catch (error) {
      throw new ApolloError(error.message, error.code)
    }
  }

  async getAllUsersByAProvider(providerId: string) {
    try {
      const users = await UserModel.find({ provider: providerId })
        .populate("provider")
        .lean()
      return users
    } catch (error) {
      throw new ApolloError(error.message, error.code)
    }
  }
}

export default UserService

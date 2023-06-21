import * as Sentry from "@sentry/node"
import { ApolloError } from "apollo-server-errors"
import { LeanDocument } from "mongoose"
import * as AWS from "aws-sdk"
import bcrypt from "bcrypt"
import config from "config"
import {
  addDays,
  addMinutes,
  addMonths,
  differenceInDays,
  isPast,
  isToday,
  format,
  isTomorrow,
  isThisWeek,
  subDays,
  isYesterday,
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
  CreateStripeCustomerInput,
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
  InsuranceEligibilityInput,
  Weight,
  File,
  User,
  FileType,
} from "../schema/user.schema"
import Role from "../schema/enums/Role"
import { signJwt } from "../utils/jwt"
import {
  getSendBirdUserChannels,
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
import axios from "axios"
import { analyzeS3InsuranceCardImage } from "../utils/textract"
import AnswerType from "../schema/enums/AnswerType"

class UserService extends EmailService {
  private taskService: TaskService
  private providerService: ProviderService
  private akuteService: AkuteService
  private appointmentService: AppointmentService
  private smsService: SmsService
  private emailService: EmailService
  private candidService: CandidService
  public awsDynamo: AWS.DynamoDB
  private stripeSdk: stripe

  constructor() {
    super()

    this.taskService = new TaskService()
    this.providerService = new ProviderService()
    this.akuteService = new AkuteService()
    this.appointmentService = new AppointmentService()
    this.smsService = new SmsService()
    this.emailService = new EmailService()
    this.candidService = new CandidService()

    this.awsDynamo = new AWS.DynamoDB({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION,
    })
    this.stripeSdk = new stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2022-08-01",
    })
  }

  async assignUserTasks(userId: string, taskTypes: TaskType[]) {
    try {
      const input = {
        userId,
        taskTypes,
      }
      await this.taskService.bulkAssignTasksToUser(input)
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
    const sent = await this.sendRegistrationEmailTemplate({
      email: user.email,
      token: emailToken,
      name: user.name,
    })
    if (!sent) {
      throw new ApolloError(emailSendError.message, emailSendError.code)
    }

    return {
      message: userCreatedMessage,
      user,
    }
  }

  async createUser(input: CreateUserInput, manual = false) {
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

    console.log(`CREATING NEW USER w/Name: ${name}`)

    const splitName = name.split(" ")
    const firstName = name.split(" ")[0] || ""
    const lastName = splitName ? splitName[splitName.length - 1] : ""

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
        console.log(message)
        Sentry.captureEvent({
          message,
          level: "error",
        })
      }
    } catch (error) {
      console.log(error.message)
      Sentry.captureException(error)
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
    await triggerEntireSendBirdFlow({
      user_id: user._id,
      nickname: user.name,
      profile_file: "",
      profile_url: "",
      provider: provider._id,
    })

    // assign initial tasks to user
    const tasks = [
      TaskType.ID_AND_INSURANCE_UPLOAD,
      TaskType.NEW_PATIENT_INTAKE_FORM,
      TaskType.MP_HUNGER,
      TaskType.MP_FEELING,
      TaskType.BP_LOG,
      TaskType.WEIGHT_LOG,
      TaskType.WAIST_LOG,
      // TaskType.MP_BLUE_CAPSULE,
      TaskType.MP_ACTIVITY,
      TaskType.FOOD_LOG,
      TaskType.TEFQ,
      TaskType.AD_LIBITUM,
      TaskType.GSRS,
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

    // send lab order
    const labOrder = this.akuteService.createLabOrder(user._id)
    if (!labOrder) {
      console.log(
        `An error occured for creating a lab order in Akute for: ${email}`
      )
      Sentry.captureException(
        `Lab Order Akute Failed for: ${user._id}, ${email}: ${JSON.stringify(
          labOrder
        )}`
      )
    }

    if (process.env.NODE_ENV === "production") {
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
    }

    console.log(`USER CREATED: ${user._id}`)

    return {
      message: userCreatedMessage,
      user,
    }
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
      Sentry.captureException(error)
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
    const dbUser = await UserModel.find().findByEmail(email).lean()
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

    const dbUser = await UserModel.find().findByEmailToken(token).lean()
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
      const user = await UserModel.findById(userId).populate("provider")
      if (!user) {
        throw new ApolloError(notFound.message, notFound.code)
      }
      return user
    } catch (error) {
      Sentry.captureException(error)
      throw new ApolloError(error.message, error.code)
    }
  }

  async getAllUsers() {
    try {
      // Find all users and populate the "provider" field
      const users = await UserModel.find().populate("provider").lean()
      users.forEach((u) => {
        if (u.score) {
          if (u.score.some((el: any) => el === null)) {
            u.score = u.score.filter((el: any) => el !== null)
          }
        } else {
          u.score = []
        }
      })

      return users
    } catch (error) {
      Sentry.captureException(error)
      throw new ApolloError(error.message, error.code)
    }
  }

  async getAllUsersByAProvider(providerId: string) {
    try {
      const _users = await UserModel.find({ provider: providerId })
        .populate("provider")
        .lean()

      const users = _users.map((u) => {
        return {
          ...u,
          score: [],
        }
      })

      return users
    } catch (error) {
      Sentry.captureException(error)
      throw new ApolloError(error.message, error.code)
    }
  }
  async getAllUsersByAHealthCoach(providerId: string) {
    try {
      const findEaHealthCoachId = await UserModel.find({
        _id: providerId,
      }).lean()
      if (!findEaHealthCoachId[0].eaHealthCoachId) {
        throw new ApolloError("No Health Coach Id found", "404")
      }
      const users = await UserModel.find({
        eaHealthCoachId: findEaHealthCoachId[0].eaHealthCoachId,
      })
        .populate("provider")
        .lean()
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

  async taskJob() {
    const users = await this.getAllPatients()
    const tasks = await TaskModel.find({ interval: { $exists: true } })

    const allNewTasks: AllTaskEmail[] = []
    const allDueTodayTasks: AllTaskEmail[] = []
    const allPastDueTasks: AllTaskEmail[] = []
    const errors: string[] = []

    // loop through each user
    for (let i = 0; i < users.length; i++) {
      const newTasks: TaskEmail[] = []
      const dueTodayTasks: TaskEmail[] = []
      const pastDueTasks: TaskEmail[] = []

      // loop through each task that has an interval
      for (let j = 0; j < tasks.length; j++) {
        // get the last user task completed for this specific task
        const uTask = await UserTaskModel.findOne(
          { task: tasks[j]._id, user: users[i]._id },
          {},
          { sort: { createdAt: -1 } }
        )

        // if exists continue
        if (uTask) {
          // if completed continue
          if (uTask.completed) {
            console.log("Inside task completed")
            const completedAt = new Date(uTask.completedAt).setHours(0, 0)
            const completedDate = addDays(
              completedAt,
              Number(tasks[j].interval)
            )

            // assign new task if its past the interval
            if (isPast(completedDate) || isToday(completedDate)) {
              console.log("task is completed and past the completed date")

              // create new user task in database
              const dueAt = addDays(
                new Date().setHours(0, 0),
                tasks[j].daysTillDue || 0
              )

              const newUTask = await UserTaskModel.create({
                user: users[i]._id,
                task: tasks[j]._id,
                dueAt: tasks[j].daysTillDue ? dueAt : undefined,
                highPriority: tasks[j].highPriority,
                lastNotifiedUserAt: new Date(new Date().setHours(0, 0)),
              })

              const dueAtFormatted = isToday(dueAt)
                ? "Today"
                : isTomorrow(dueAt)
                ? "Tomorrow"
                : isThisWeek(dueAt)
                ? `${format(dueAt, "EEE")}`
                : `${format(dueAt, "EEE, LLL do")}`

              // send email that new task was assigned
              newTasks.push({
                taskName: tasks[j].name,
                dueAt: dueAtFormatted,
                taskId: newUTask._id,
              })

              // add to output for report email
              allNewTasks.push({
                taskName: tasks[j].name,
                dueAt: dueAtFormatted,
                taskId: newUTask._id,
                userId: users[i]._id,
                userName: users[i].name,
                userEmail: users[i].email,
              })
            }
          } else {
            const interval = Number(tasks[j].interval)
            const isDueToday = isToday(
              subDays(new Date(uTask.dueAt).setHours(0, 0), 1)
            )
            const daysSinceNotified = differenceInDays(
              new Date().setHours(0, 0),
              new Date(uTask.lastNotifiedUserAt).setHours(0, 0)
            )

            console.log(tasks[j].name, interval, daysSinceNotified)

            // if interval is 21 days or greater notify the day its due
            if (interval >= 21 && isDueToday && daysSinceNotified > 0) {
              console.log("inside notify due today")
              dueTodayTasks.push({
                taskName: tasks[j].name,
                dueAt: "Today",
                taskId: uTask._id,
              })

              allDueTodayTasks.push({
                taskName: tasks[j].name,
                dueAt: "Today",
                taskId: uTask._id,
                userId: users[i]._id,
                userName: users[i].name,
                userEmail: users[i].email,
              })

              uTask.lastNotifiedUserAt = new Date()
              await uTask.save()

              // if past due starting today and you havent been notified today
              // or if its past due and its been 3 or more days since the user has been notified
            } else if (
              (isToday(new Date(uTask.dueAt).setHours(0, 0)) &&
                daysSinceNotified > 0) ||
              (isPast(new Date(uTask.dueAt).setHours(0, 0)) &&
                daysSinceNotified >= 3)
            ) {
              const pastDueFormatted = isToday(uTask.dueAt)
                ? "Today"
                : isYesterday(uTask.dueAt)
                ? "Yesterday"
                : `${format(uTask.dueAt, "EEE, LLL do")}`

              pastDueTasks.push({
                taskName: tasks[j].name,
                dueAt: pastDueFormatted,
                taskId: uTask._id,
              })

              uTask.lastNotifiedUserAt = new Date()
              await uTask.save()

              allPastDueTasks.push({
                taskName: tasks[j].name,
                dueAt: pastDueFormatted,
                taskId: uTask._id,
                userId: users[i]._id,
                userName: users[i].name,
                userEmail: users[i].email,
              })
            }
          }
        } else if (
          tasks[j].type !== TaskType.SCHEDULE_APPOINTMENT ||
          tasks[j].type !== TaskType.SCHEDULE_HEALTH_COACH_APPOINTMENT
        ) {
          console.log("No task yet, create new one")

          // create new user task in database
          const dueAt = addDays(
            new Date().setHours(0, 0),
            tasks[j].daysTillDue || 0
          )

          const newUTask = await UserTaskModel.create({
            user: users[i]._id,
            task: tasks[j]._id,
            dueAt: tasks[j].daysTillDue ? dueAt : undefined,
            highPriority: tasks[j].highPriority,
            lastNotifiedUserAt: new Date(new Date().setHours(0, 0)),
          })

          const dueAtFormatted = isToday(dueAt)
            ? "Today"
            : isTomorrow(dueAt)
            ? "Tomorrow"
            : isThisWeek(dueAt)
            ? `${format(dueAt, "EEE")}`
            : `${format(dueAt, "EEE, LLL do")}`

          // send email that new task was assigned
          newTasks.push({
            taskName: tasks[j].name,
            dueAt: dueAtFormatted,
            taskId: newUTask._id,
          })

          // add to output for report email
          allNewTasks.push({
            taskName: tasks[j].name,
            dueAt: dueAtFormatted,
            taskId: newUTask._id,
            userId: users[i]._id,
            userName: users[i].name,
            userEmail: users[i].email,
          })
        }
      }

      if (
        newTasks.length > 0 ||
        pastDueTasks.length > 0 ||
        dueTodayTasks.length > 0
      ) {
        console.log("inside send email")
        // send email
        const sent = await this.sendTaskEmail({
          name: users[i].name,
          email: users[i].email,
          newTasks,
          pastDueTasks,
          dueTodayTasks,
        })

        if (!sent) {
          errors.push(
            `An error occured sending task email to user (${users[i]._id}): ${users[i].email}`
          )
        }

        // send sms
        const smsSent = await this.smsService.sendTaskSms({
          name: users[i].name,
          phone: users[i].phone,
          newTasks,
          pastDueTasks,
          dueTodayTasks,
          timezone: users[i].timezone,
        })

        if (!smsSent.sid) {
          errors.push(
            `An error occured sending task sms to user (${users[i]._id}): ${users[i].email}, ${users[i].phone}`
          )
        }
      }
    }

    // send report
    if (
      allNewTasks.length > 0 ||
      allPastDueTasks.length > 0 ||
      allDueTodayTasks.length > 0
    ) {
      const sent = await this.sendTaskReport({
        allNewTasks,
        allPastDueTasks,
        allDueTodayTasks,
        errors,
      })

      if (!sent) {
        console.log(`An error occured sending the daily task report: ${sent}`)
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
      console.log("error", error)
      Sentry.captureException(error)
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
      })
      checkout.user = newUser._id
      user = newUser
    }

    checkout.checkedOut = true
    await checkout.save()

    return {
      message: checkoutCompleted,
      user,
    }
  }

  async getCheckout(checkoutId: string) {
    const { checkoutNotFound, alreadyCheckedOut } = config.get(
      "errors.checkout"
    ) as any

    const checkout = (await CheckoutModel.findById(
      checkoutId
    ).lean()) as LeanDocument<Checkout>
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
    insurance = false,
  }: CreateStripeCustomerInput) {
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
    const existingCustomer = await this.stripeSdk.customers.list({
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
      await this.stripeSdk.customers.update(customer.id, {
        address: stripeShipping,
        phone: checkout.phone,
        name: checkout.name,
        email: checkout.email,
      })
    }

    if (checkout.stripeSetupIntentId) {
      setupIntent = await this.stripeSdk.setupIntents.retrieve(
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
        INSURANCE: `${insurance ? "TRUE" : "FALSE"}`,
      },
      ...(customer && { customer: customer.id }),
    }

    // create payment intent
    if (setupIntent && setupIntent.status !== "canceled") {
      setupIntent = await this.stripeSdk.setupIntents.update(setupIntent.id, {
        ...setupIntentDetails,
      })
    } else {
      setupIntent = await this.stripeSdk.setupIntents.create({
        ...setupIntentDetails,
      })
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

  async createOrFindCheckout(input: CreateCheckoutInput) {
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
      address,
      insurancePlan,
      insuranceType,
      signupPartner,
    } = input

    const checkout = await CheckoutModel.find().findByEmail(email).lean()
    if (checkout) {
      // check if already checked out
      if (checkout.checkedOut) {
        throw new ApolloError(alreadyCheckedOut.message, alreadyCheckedOut.code)
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
      checkout.shippingAddress = address
      checkout.insurancePlan = insurancePlan
      checkout.insuranceType = insuranceType
      checkout.signupPartner = signupPartner

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
      insurancePlan,
      insuranceType,
      signupPartner,
      shippingAddress: address,
    })

    // return new checkout
    return {
      message: checkoutCreated,
      checkout: newCheckout,
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

      const prompt = `This Patient has the following classifications and percentiles: ${subTypesText}. ${weightInfo} and are currently on this or these doses of medication: ${medications}`
      console.log(prompt, "prompt")
      const params = {
        model: "gpt-4",
        temperature: 0,
        messages: [
          {
            role: ChatCompletionRequestMessageRoleEnum.System,
            content:
              "Act as a medical assistant for an obesity clinic. This is a novel protocol using data from patients to recommend certain drugs and titrations. Your job is to recommend the medication and dose dictated by this protocol, as well as any recommended changes to current medications if they are weight gain causes.Do not include any extraneous information in your response.Ignore duplicate medications.",
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
      console.log("error", error)
      Sentry.captureException(error)
    }
  }

  /** Completes an upload by saving the files uploaded to S3 to the database. */
  async completeUpload(input: File[], userId: string): Promise<User> {
    const { notFound } = config.get("errors.user") as any
    const user = await UserModel.findById(userId).countDocuments()
    if (!user) {
      throw new ApolloError(notFound.message, notFound.code)
    }
    const update = await UserModel.findOneAndUpdate(
      { _id: userId },
      {
        $push: {
          files: { $each: input },
        },
      },
      { new: true }
    )

    const insuranceFile = input.find(
      (file) => file.type === FileType.InsuranceCard
    )
    if (insuranceFile) {
      const bucket: string = config.get("s3.patientBucketName")
      const insuranceData = await analyzeS3InsuranceCardImage(
        bucket,
        insuranceFile.key
      )
      const insuranceInput: InsuranceEligibilityInput = {
        userId,
        memberId: insuranceData.member_id,
        groupId: insuranceData.group_number,
        groupName: insuranceData.group_name,
        payor: insuranceData.payer_id,
        insuranceCompany: insuranceData.payer_name,
        rxBin: insuranceData.rx_bin,
        rxGroup: insuranceData.rx_pcn,
      }

      const logMessage = `Parsed insurance data from card: ${JSON.stringify(
        insuranceInput
      )}`
      console.log(logMessage)
      Sentry.captureMessage(logMessage)

      try {
        const eligible = await this.checkInsuranceEligibility(insuranceInput)
        if (eligible) {
          await this.updateInsurance(insuranceInput)
        }
      } catch (error) {
        // error is Sentry captured in checkInsuranceEligibility.
        console.log("Error during eligibility check.", error)
      }
    }

    return update
  }

  /** Updates insurance information for a given user. */
  async updateInsurance(input: InsuranceEligibilityInput): Promise<void> {
    const { userId } = input
    const notFound = config.get("errors.user.notFound") as any

    // Get the user by ID
    const user: LeanDocument<User> = await UserModel.findById(userId).lean()
    if (!user) {
      throw new ApolloError(notFound.message, notFound.code)
    }

    // update insurance fields
    user.insurance = {
      memberId: input.memberId,
      groupId: input.groupId,
      groupName: input.groupName,
      insuranceCompany: input.insuranceCompany,
      rxBin: input.rxBin,
      rxGroup: input.rxGroup,
      payor: input.payor,
    }

    await UserModel.findByIdAndUpdate(user._id, user)
  }

  async checkInsuranceEligibility(input: InsuranceEligibilityInput) {
    try {
      const user = await UserModel.findById(input.userId).populate<{
        provider: Provider
      }>("provider")
      if (!user) throw new Error(`User ${input.userId} not found.`)

      const { provider } = user
      if (!provider)
        throw new Error(`No provider associated with user ${input.userId}.`)

      const insuranceResult = await this.akuteService.createInsurance(
        user.akutePatientId,
        input
      )

      console.log(`Insurance result: ${JSON.stringify(insuranceResult)}`)

      const { eligible, reason: ineligibleReason } =
        await this.candidService.checkInsuranceEligibility(
          user,
          provider,
          input
        )

      Sentry.captureEvent({
        message: `[CANDID HEALTH][TIME: ${new Date().toISOString()}][EVENT: eligibility] ${
          eligible
            ? "Eligible Determination"
            : `Ineligible: ${ineligibleReason}`
        }`,
      })

      await this.emailService.sendEligibilityCheckResultEmail({
        patientName: user.name,
        patientEmail: user.email,
        patientPhone: user.phone,
        eligible,
        reason: ineligibleReason,
      })

      return eligible
    } catch (e) {
      throw new ApolloError(e.message, "ERROR")
    }
  }

  /**
   * Record a withings scale reading and process insurance.
   */
  async processWithingsScaleReading(
    metriportUserId: string,
    weightLbs: number,
    date: Date = new Date()
  ): Promise<{ user: User; userTask: UserTask }> {
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
    }

    const task = await TaskModel.findOne({ type: TaskType.WEIGHT_LOG })
    const incompleteUserTask = await UserTaskModel.findOne({
      user: user._id,
      task: task._id,
      completed: false,
    })

    const userAnswer: UserNumberAnswer = {
      key: "scaleWeight",
      value: weightLbs,
      type: AnswerType.NUMBER,
    }

    let userTask: UserTask
    if (incompleteUserTask) {
      userTask = await this.taskService.completeUserTask({
        _id: incompleteUserTask._id.toString(),
        answers: [userAnswer],
      })
    } else {
      const errorMessage = `No uncompleted weight log task for user: ${
        user._id
      } - Could not record scale reading: ${JSON.stringify(userAnswer)}`
      const message = `[METRIPORT][TIME: ${new Date().toString()}] ${errorMessage}`
      console.log(message)
      Sentry.captureEvent({
        message,
        level: "warning",
      })
      throw new ApolloError(errorMessage)
    }

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
      await this.candidService.createCodedEncounterForScaleEvent(
        user,
        user.provider,
        user.weights
      )
    } else {
      console.log(
        "UserService.processWithingsScaleReading: No insurance processing for scale event, user has stripe subscription."
      )
    }

    return { user, userTask }
  }
}

export default UserService

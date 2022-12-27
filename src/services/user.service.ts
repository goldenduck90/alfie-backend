import * as Sentry from "@sentry/node"
import { ApolloError } from "apollo-server-errors"
import * as AWS from "aws-sdk"
import bcrypt from "bcrypt"
import config from "config"
import { addMinutes, addMonths } from "date-fns"
import stripe from "stripe"
import { v4 as uuidv4 } from "uuid"
import {
  CheckoutModel,
  CreateCheckoutInput,
  CreateStripeCustomerInput
} from "../schema/checkout.schema"
import { LabModel } from "../schema/lab.schema"
import { ProviderModel } from "../schema/provider.schema"
import { TaskType } from "../schema/task.schema"
import { UserTaskModel } from "../schema/task.user.schema"
import {
  CompletePaymentIntentInput,
  CreateUserInput,
  ForgotPasswordInput,
  LoginInput,
  ResetPasswordInput,
  Role,
  SubscribeEmailInput,
  UpdateSubscriptionInput,
  UserModel,
  Weight
} from "../schema/user.schema"
import { signJwt } from "../utils/jwt"
import { triggerEntireSendBirdFlow } from "../utils/sendBird"
import AkuteService from "./akute.service"
import AppointmentService from "./appointment.service"
import EmailService from "./email.service"
import ProviderService from "./provider.service"
import TaskService from "./task.service"
class UserService extends EmailService {
  private taskService: TaskService
  private providerService: ProviderService
  private akuteService: AkuteService
  private appointmentService: AppointmentService
  public awsDynamo: AWS.DynamoDB
  private stripeSdk: stripe

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

    console.log(`CREATING NEW USER w/Name: ${name}`)

    const splitName = name.split(" ")
    const firstName = name.split(" ")[0] || ""
    const lastName = splitName ? splitName[splitName.length - 1] : ""

    const patientId = await this.akuteService.createPatient({
      firstName,
      lastName,
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
      firstName,
      lastName,
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
    const selectedProvider = await ProviderModel.findById(provider._id).lean()
    // trigger sendbird flow
    await triggerEntireSendBirdFlow({
      user_id: user._id,
      nickname: user.name,
      profile_file: "",
      profile_url: "",
      provider: provider._id,
      providerName: `${selectedProvider.firstName} ${selectedProvider.lastName}`,
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

    return {
      message: userCreatedMessage,
      user,
    }
  }

  async completePaymentIntent(input: CompletePaymentIntentInput) {
    try {
      const { paymentIntentId } = input
      const priceId = config.get("defaultPriceId") as any

      const paymentIntent = await this.stripeSdk.paymentIntents.retrieve(
        paymentIntentId
      )

      if (!paymentIntent || paymentIntent.status !== "succeeded") {
        throw new ApolloError("Payment intent not found", "NOT_FOUND")
      } else {
        const stripePaymentMethodId = paymentIntent.payment_method as string
        const existingCheckout = await CheckoutModel.findById(
          paymentIntent.metadata.checkoutId
        )

        // create customer
        if (!existingCheckout?.stripeSubscriptionId) {
          const customer = await this.stripeSdk.customers.create({
            name: paymentIntent?.shipping?.name,
            payment_method: stripePaymentMethodId,
            email: paymentIntent?.metadata?.email,
            phone: paymentIntent?.shipping?.phone,
            invoice_settings: {
              default_payment_method: stripePaymentMethodId,
            },
            shipping: {
              name: paymentIntent?.shipping?.name,
              address: paymentIntent?.shipping?.address,
              phone: paymentIntent?.shipping?.phone,
            },
            metadata: {
              checkoutId: paymentIntent?.metadata?.checkoutId,
            },
            address: paymentIntent?.shipping?.address,
          })

          if (!customer) {
            throw new ApolloError(
              "Customer not created",
              "INTERNAL_SERVER_ERROR"
            )
          }

          // create subscription
          const subscription = await this.stripeSdk.subscriptions.create({
            customer: customer.id,
            items: [{ price: priceId }],
            default_payment_method: stripePaymentMethodId,
            collection_method: "charge_automatically",
            trial_period_days: 30,
          })

          // update checkout
          const checkout = await CheckoutModel.findByIdAndUpdate(
            paymentIntent.metadata.checkoutId,
            {
              stripeCustomerId: customer.id,
              stripeSubscriptionId: subscription.id,
            }
          )

          if (!checkout) {
            throw new ApolloError("Checkout not found", "NOT_FOUND")
          }

          // create user
          const { message } = await this.completeCheckout(
            subscription.id,
            new Date(subscription.current_period_end)
          )

          return { message }
        } else {
          // get subscription
          const subscription = await this.stripeSdk.subscriptions.retrieve(
            existingCheckout.stripeSubscriptionId
          )

          if (!subscription) {
            throw new ApolloError("Subscription not found", "NOT_FOUND")
          }

          // create user
          const { message } = await this.completeCheckout(
            existingCheckout.stripeSubscriptionId,
            new Date(subscription.current_period_end)
          )

          return { message }
        }
      }
    } catch (error) {
      console.log(error)
      Sentry.captureException(error)
      throw new ApolloError("An error occured", "INTERNAL_SERVER_ERROR")
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
      const subscription = await this.stripeSdk.subscriptions.retrieve(
        stripeSubscriptionId
      )

      if (!subscription) {
        throw new ApolloError(notFound.message, notFound.code)
      } else {
        const checkoutId = subscription.metadata.checkoutId
        const checkout = await CheckoutModel.findById(checkoutId)

        if (!checkout) {
          throw new ApolloError(notFound.message, notFound.code)
        } else {
          return { message: "User hasn't been created yet, skipping..." }
        }
      }
    } else {
      user.subscriptionExpiresAt = subscriptionExpiresAt
      await UserModel.findByIdAndUpdate(user._id, user)

      return { message }
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
      console.log(error, "error")
      Sentry.captureException(error)
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
  async getAllUserTasksByUser(userId: string) {
    try {
      const userTasks: any = await UserTaskModel.find({ user: userId })
        .populate("task")
        .lean()
      // If the task is of type Medical Questionnaire, we need find the answer that the user has given with the key labCorpLocation and find the location name from the LabsModel and populate the value in the userTask
      const userTasksWithLabCorpLocation = await Promise.all(
        userTasks.map(async (userTask: any) => {
          if (userTask.task.type === TaskType.NEW_PATIENT_INTAKE_FORM) {
            const labCorpLocation = userTask.answers.find(
              (answer: any) => answer.key === "labCorpLocation"
            )
            if (labCorpLocation && labCorpLocation.value !== "null") {
              const lab = await LabModel.findById(labCorpLocation.value)
              if (lab) {
                labCorpLocation.value = `${lab.name} - ${lab.streetAddress} ${lab.city}, ${lab.state} ${lab.postalCode}`
              }
            }
          }
          return userTask
        })
      )
      return userTasksWithLabCorpLocation
      // return userTasks
    } catch (error) {
      Sentry.captureException(error)
    }
  }

  async completeCheckout(
    stripeSubscriptionId: string,
    subscriptionExpiresAt: Date
  ) {
    const { checkoutCompleted } = config.get("messages") as any
    const { notFound, alreadyCheckedOut } = config.get("errors.checkout") as any

    const checkout = await CheckoutModel.find()
      .findByStripeSubscriptionId(stripeSubscriptionId)
      .lean()

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

    const { user } = await this.createUser({
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

    checkout.checkedOut = true
    checkout.user = user._id
    await CheckoutModel.findByIdAndUpdate(checkout._id, checkout)

    return {
      message: checkoutCompleted,
      user,
    }
  }

  async getCheckout(checkoutId: string) {
    const { checkoutNotFound, alreadyCheckedOut } = config.get(
      "errors.checkout"
    ) as any

    const checkout = await CheckoutModel.findById(checkoutId).lean()
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

    const stripeShipping = {
      line1: shipping.line1,
      line2: shipping.line2,
      city: shipping.city,
      state: shipping.state,
      postal_code: shipping.postalCode,
    }

    if (checkout.stripePaymentIntentId) {
      const existingPaymentIntent =
        await this.stripeSdk.paymentIntents.retrieve(
          checkout.stripePaymentIntentId
        )

      if (existingPaymentIntent.status === "canceled") {
        const newPaymentIntent = await this.stripeSdk.paymentIntents.create({
          description: "Alfie Subscription - First Payment",
          amount: 12000,
          currency: "usd",
          setup_future_usage: "off_session",
          metadata: {
            checkoutId: String(checkout._id),
            email: checkout.email,
          },
          shipping: {
            name: checkout.name,
            address: stripeShipping,
            phone: checkout.phone,
          },
        })

        checkout.stripePaymentIntentId = newPaymentIntent.id
        checkout.stripeClientSecret = newPaymentIntent.client_secret
        await checkout.save()
      }

      checkout.shippingAddress = shipping
      checkout.billingAddress = sameAsShipping ? shipping : billing
      await checkout.save()

      return {
        checkout,
      }
    }

    // create payment intent
    const paymentIntent = await this.stripeSdk.paymentIntents.create({
      description: "Alfie Subscription - First Payment",
      amount: 12000,
      currency: "usd",
      setup_future_usage: "off_session",
      metadata: {
        checkoutId: String(checkout._id),
        email: checkout.email,
      },
      shipping: {
        name: checkout.name,
        address: stripeShipping,
        phone: checkout.phone,
      },
    })

    // update checkout with stripe info
    checkout.stripePaymentIntentId = paymentIntent.id
    checkout.stripeClientSecret = paymentIntent.client_secret
    checkout.shippingAddress = shipping
    checkout.billingAddress = sameAsShipping ? shipping : billing

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
      weightLossMotivator,
      dateOfBirth,
      gender,
      state,
      heightInInches,
      weightInLbs,
      textOptIn,
      phone,
    } = input

    const checkout = await CheckoutModel.find().findByEmail(email).lean()
    if (checkout) {
      // check if already checked out
      if (checkout.checkedOut) {
        throw new ApolloError(alreadyCheckedOut.message, alreadyCheckedOut.code)
      }

      // update values
      checkout.name = name
      checkout.weightLossMotivator = weightLossMotivator
      checkout.dateOfBirth = dateOfBirth
      checkout.gender = gender
      checkout.state = state
      checkout.heightInInches = heightInInches
      checkout.weightInLbs = weightInLbs
      checkout.textOptIn = textOptIn
      checkout.phone = phone

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
      weightLossMotivator,
      dateOfBirth,
      gender,
      state,
      heightInInches,
      weightInLbs,
      textOptIn,
      phone,
    })

    // return new checkout
    return {
      message: checkoutCreated,
      checkout: newCheckout,
    }
  }
}

export default UserService

export default {
  errors: {
    tasks: {
      alreadyAssigned: {
        code: "ALREADY_EXISTS",
        message: "Task already assigned to user",
      },
      notFound: {
        code: "NOT_FOUND",
        message: "Task not found",
      },
      noTasks: {
        code: "NOT_FOUND",
        message:
          "You have no tasks to complete right now. We'll notify you when you do!",
      },
      userNotFound: {
        code: "NOT_FOUND",
        message: "User not found",
      },
      notPermitted: {
        code: "UNAUTHORIZED",
        message: "You are not permitted to view another patient's task.",
      },
    },
    provider: {
      notFound: {
        code: "NOT_FOUND",
        message: "Provider not found",
      },
      calIdNotFound: {
        code: "NOT_FOUND",
        message: "Provider cal id not found",
      },
    },
    user: {
      notFound: {
        code: "NOT_FOUND",
        message: "User not found",
      },
      noEaCustomerId: {
        code: "NOT_FOUND",
        message: "User does not have an EA customer ID",
      },
    },
    registration: {
      invalidToken: {
        message: "Invalid token provided! Please contact support.",
        code: "BAD_REQUEST",
      },
    },
    forgotPassword: {
      emailNotFound: {
        message:
          "We couldn't find an account with that email address. Please try again.",
        code: "BAD_REQUEST",
      },
      emailSendError: {
        message: "There was an error sending you an email. Please try again.",
        code: "BAD_REQUEST",
      },
    },
    resetPassword: {
      invalidToken: {
        message: "Invalid token provided! Please contact support.",
        code: "BAD_REQUEST",
      },
      tokenExpired: {
        message:
          "Your token has expired. Please check your email for a new link.",
        code: "BAD_REQUEST",
      },
    },
    login: {
      invalidCredentials: {
        message: "Invalid credentials! Please try again.",
        code: "BAD_REQUEST",
      },
      passwordNotCreated: {
        message:
          "You haven't completed the registration process. Please check your email for a link.",
        code: "BAD_REQUEST",
      },
    },
    subscribeEmail: {
      unknownError: {
        message: "An error occured subscribing you to our email list.",
        code: "INTERNAL_SERVER_ERROR",
      },
    },
    createUser: {
      alreadyExists: {
        message: "An account with that email address already exists.",
        code: "BAD_REQUEST",
      },
      unknownError: {
        message: "An error occured creating your account.",
        code: "INTERNAL_SERVER_ERROR",
      },
      emailSendError: {
        message:
          "There was an error sending your registration email. Please contact support.",
        code: "BAD_REQUEST",
      },
    },
    checkout: {
      notFound: {
        message: "We couldn't find a checkout with that email address or ID.",
        code: "BAD_REQUEST",
      },
      alreadyCheckedOut: {
        message: "You've already signed up for Alfie!",
        code: "ALREADY_EXISTS",
      },
      paymentNotComplete: {
        message: "Your payment was not completed. Please contact support.",
        code: "PAYMENT_NOT_COMPLETE",
      },
    },
    updateSubscription: {
      notFound: {
        message: "We couldn't find a user associated with that subscription.",
        code: "BAD_REQUEST",
      },
    },
  },
  validations: {
    password: {
      length: {
        minValue: 6,
        minMessage: "Your password must be at least 6 characters long.",
        maxValue: 50,
        maxMessage: "Your password must not be longer than 50 characters.",
      },
    },
    phone: {
      message: "Please enter a valid phone number.",
    },
    email: {
      message: "The email address you've entered is invalid.",
    },
    dateOfBirth: {
      message: "The date of birth you've entered is invalid.",
      minAge: {
        value: 18,
        message: "You must be at least 18 years old to sign up.",
      },
    },
  },
  messages: {
    forgotPassword:
      "We've sent you an email with instructions on how to reset your password.",
    resetPassword: "Your password has been reset! Logging in...",
    completedRegistration: "Your password has been set! Logging in...",
    subscribeEmail:
      "You've been successfully subscribed to our waitlist. We will email you as soon as we launch in your area.",
    checkoutFound: "Checkout updated successfully.",
    checkoutCreated: "Checkout created successfully.",
    checkoutCompleted: "Checkout completed successfully.",
    userCreatedViaCheckout:
      "Thank you for subscribing to Alfie! Please check your email to complete your registration.",
    userCreatedManually:
      "User created successfully. They will receive an email to complete their registration.",
    updateSubscription: "Subscription updated successfully.",
    taskCompleted: "Task completed successfully.",
  },
  jwtExpiration: {
    rememberExp: "7d",
    normalExp: "1d",
  },
  emails: {
    forgotPassword: {
      path: "reset-password",
      subject: "Reset your password",
    },
    completeRegistration: {
      path: "reset-password",
      subject: "Complete your Alfie registration",
    },
    taskAssigned: {
      path: "task",
      subject: "You've been assigned a new task",
    },
  },
  paths: {
    checkoutSuccess: "signup/checkout/success",
  },
  forgotPasswordExpirationInMinutes: 360,
  noReplyEmail: "no-reply@joinalfie.com",
  s3: {
    expiresInSeconds: 600, // 10 mins
    labOrderTemplateKey: "LAB_ORDER_TEMPLATE.pdf",
    labOrderTemplateBucket: "alfie-lab-templates",
  },
  intercomApiUrl: "https://api.intercom.io",
  defaultPriceId: "price_1KMviXDOjl0X0gOq9Pk7gRFE",
  akute: {
    labCorpAccountNumber: "31196710",
    labCorpOrganizationId: "f-e20f61500ba128d340068ff6",
  },
  twilioAccountSid: "ACbb4313087a5ddfe068560647a79f55aa",
  twilioMessagingServiceSid: "MGc9274f6baa27f492eaf008c8e77fd947",
  dailyApiUrl: "https://api.daily.co/v1",
}

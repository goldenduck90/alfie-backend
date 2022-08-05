export default {
  errors: {
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
      emailNotVerified: {
        message:
          "You haven't completed the registration process. Please check your email.",
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
    email: {
      message: "The email address you've entered is invalid.",
    },
  },
  messages: {
    forgotPassword:
      "We've sent you an email with instructions on how to reset your password.",
    resetPassword: "Your password has been reset! Logging in...",
    completedRegistration: "Your password has been set! Logging in...",
  },
  paths: {
    forgotPassword: "forgot-password",
  },
  jwtExpiration: {
    rememberExp: "7d",
    normalExp: "1d",
  },
}

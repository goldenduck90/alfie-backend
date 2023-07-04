import * as SentryObject from "@sentry/node"

export default SentryObject

function setupSentry() {
  SentryObject.init({
    dsn: "https://e99c3274029e405f9e1b6dd50a63fd85@o4504040965603328.ingest.sentry.io/4504040986705920",
    environment: process.env.NODE_ENV,
    // Set tracesSampleRate to 1.0 to capture 100%
    // of transactions for performance monitoring.
    // We recommend adjusting this value in production
    tracesSampleRate: 1.0,
  })
}

setupSentry()

/** Captures an event, logging the message and data, and sending to Sentry. */
export function captureEvent(
  level: SentryObject.SeverityLevel,
  message: string,
  data?: Record<string, any>
) {
  SentryObject.withScope((scope) => {
    console.log(`[${level}] ${message} - ${JSON.stringify(data)}`)
    if (data) {
      data = prepareContextObject(data)
      Object.keys(data).forEach((field) => scope.setContext(field, data[field]))
    }
    if (message) scope.setContext("message", { log: message })

    SentryObject.captureEvent({
      message,
      level,
      contexts: { data },
    })
  })
}

/** Captures an exception, logging the message and sending to Sentry. */
export function captureException(
  error: any,
  message?: string,
  data?: Record<string, any>
) {
  if (error?.response?.data) error = error.response?.data

  if (!error || !(error instanceof Error)) {
    data.error = error
    error = null
  }

  SentryObject.withScope((scope) => {
    data = prepareContextObject(data)
    if (data) {
      Object.keys(data).forEach((field) => scope.setContext(field, data[field]))
    }

    scope.setContext("message", {
      log: message ?? "None",
      error: error?.message ?? "None",
    })

    console.log(error)
    console.log(
      `[error]${message ? ` ${message}` : ""}${
        data ? ` - ${JSON.stringify(data)}` : ""
      }`
    )
    SentryObject.captureException(
      error || new Error(message ?? "Error - see issue context")
    )
  })
}

/**
 * Converts the data passed to the sentry log function into a format
 * that will be compatible with Sentry's UI view of the event contexts.
 */
function prepareContextObject(data: Record<string, any>) {
  const result: Record<string, Record<string, any>> = {}
  const dataKey = "Other Values"
  for (const key in data) {
    const value = data[key]
    if (typeof value === "object") {
      result[key] = value
    } else {
      result[dataKey] = result[dataKey] ?? {}
      result[dataKey][key] = value
    }
  }

  return result
}

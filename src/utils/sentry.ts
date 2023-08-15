import * as SentryObject from "@sentry/node"

const disableSentryConsoleLogs =
  process.env.DISABLE_SENTRY_CONSOLE_LOGS === "true"

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
    if (!disableSentryConsoleLogs)
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
    data = data || {}
    data.error = {
      ...(data.error ?? {}),
      ...(typeof error === "object" ? error : { error }),
    }
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

    if (error && !disableSentryConsoleLogs) {
      console.log(error)
    }

    !disableSentryConsoleLogs &&
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
export function prepareContextObject(data: Record<string, any>) {
  const result: Record<string, Record<string, any>> = {}
  const defaultDataKey = "Other Values"

  const stringifyValue = (v: any) => {
    if (Array.isArray(v) || (v && typeof v === "object"))
      return JSON.stringify(v, null, "  ")
    else return v
  }

  for (const category in data) {
    const value = data[category]
    if (Array.isArray(value)) {
      result[category] = result[category] ?? {}
      value.forEach((v, index) => {
        result[category][`Index: ${index}`] = stringifyValue(v)
      })
    } else if (value && typeof value === "object") {
      result[category] = Object.keys(value).reduce(
        (map, key) => ({
          ...map,
          [key]: stringifyValue(value[key]),
        }),
        {} as Record<string, string>
      )
    } else {
      result[defaultDataKey] = result[defaultDataKey] ?? {}
      result[defaultDataKey][category] = stringifyValue(value)
    }
  }

  return result
}

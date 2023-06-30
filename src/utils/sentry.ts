import * as SentryObject from "@sentry/node"

SentryObject.init({
  dsn: "https://e99c3274029e405f9e1b6dd50a63fd85@o4504040965603328.ingest.sentry.io/4504040986705920",
  environment: process.env.NODE_ENV,
  // Set tracesSampleRate to 1.0 to capture 100%
  // of transactions for performance monitoring.
  // We recommend adjusting this value in production
  tracesSampleRate: 1.0,
})

export default SentryObject

/** Captures an event, logging the message and data, and sending to Sentry. */
export function captureEvent(
  level: SentryObject.SeverityLevel,
  message: string,
  data?: Record<string, any>
) {
  console.log(`[${level}] ${message} - ${JSON.stringify(data)}`)
  SentryObject.captureEvent({
    message,
    level,
    contexts: { data },
  })
}

/** Captures an exception, logging the message and sending to Sentry. */
export function captureException(
  error: any,
  message?: string,
  data?: Record<string, any>
) {
  console.log(error)
  console.log(
    `[error]${message ? ` ${message}` : ""}${
      data ? ` - ${JSON.stringify(data)}` : ""
    }`
  )
  SentryObject.captureEvent({
    exception: error,
    contexts: data ? { data } : undefined,
    message: message ?? undefined,
    level: "error",
  })
}

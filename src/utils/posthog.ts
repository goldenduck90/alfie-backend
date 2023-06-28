import { PostHog } from "posthog-node"

export const client = new PostHog(
  "phc_QYJjeDHXEdTiczk7UcFeYWno6Giw9TusB44s5WwqgPb",
  { host: "https://app.posthog.com" }
)

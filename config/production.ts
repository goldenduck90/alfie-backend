import dotenv from "dotenv"
dotenv.config()

import candidHealth from "./includes/candidHealth.production"
import akuteProcedures from "./includes/akuteProcedures.production"

export default {
  env: "production",
  dbUri: `mongodb+srv://production:${process.env.DB_PASSWORD}@platform-production-clu.wnd0f.mongodb.net/?retryWrites=true&w=majority`,
  baseUrl: "https://app.joinalfie.com",
  easyAppointmentsApiUrl: "https://ea.joinalfie.com/index.php/api/v1",
  sendBirdApiUrl:
    "https://api-56D883B9-B30F-428B-8B7A-31184E513DF4.sendbird.com",
  candidHealth: {
    apiUrl: "https://api.joincandidhealth.com/api",
    clientId: process.env.CANDID_CLIENT_ID,
    clientSecret: process.env.CANDID_CLIENT_SECRET,
    serviceTypeCodes: ["3", "BZ", "30"],
    settings: candidHealth,
  },
  google: {
    apiKey: process.env.GOOGLE_API_KEY,
  },
  withings: {
    apiUrl: "https://wbsapi.withings.net",
    clientId: process.env.WITHINGS_CLIENT_ID,
    clientSecret: process.env.WITHINGS_CLIENT_SECRET,
  },
  s3: {
    patientBucketName: "production-platform-patient-storage",
    checkoutBucketName: "production-platform-checkout-storage",
  },
  dynamoDb: {
    emailSubscribersTable: "production-platform-email-subscribers",
    waitlistTable: "production-platform-waitlist",
  },
  ringCentral: {
    clientId: "L_mex0WgQg6_j-KcMNBAcg",
    number: "+19178934212",
    extension: "101",
  },
  akuteApiUrl: "https://api.akutehealth.com/v1",
  akute: {
    labCorpOrganizationId: "f-a855594f43fe879c6570b92e",
    procedures: akuteProcedures,
  },
  twilioPhone: "+18447244465",
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    defaultPriceId: "price_1KMv4hDOjl0X0gOqRIWXpGVz",
    partnerPriceId: "price_1KMv4hDOjl0X0gOqRIWXpGVz",
  },
  zapierCreateUserWebhook:
    "https://hooks.zapier.com/hooks/catch/12197313/34bsrhc/",
}

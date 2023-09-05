import dotenv from "dotenv"
dotenv.config()

import candidHealth from "./includes/candidHealth.development"
import akuteProcedures from "./includes/akuteProcedures.development"

export default {
  env: "staging",
  dbUri: `mongodb+srv://dev_staging:${process.env.DB_PASSWORD}@platform-staging-cluste.zn2qm3z.mongodb.net/staging?retryWrites=true&w=majority`,
  baseUrl: "https://staging.joinalfie.com",
  easyAppointmentsApiUrl: "https://staging.ea.joinalfie.com/index.php/api/v1",
  sendBirdApiUrl:
    "https://api-A66F3382-20F0-4D65-8D38-0355991A05E3.sendbird.com",
  candidHealth: {
    apiUrl: "https://api-staging.joincandidhealth.com/api",
    clientId: process.env.CANDID_CLIENT_ID,
    clientSecret: process.env.CANDID_CLIENT_SECRET,
    serviceTypeCodes: ["90", "3", "30", "BZ"],
    settings: candidHealth,
  },
  withings: {
    apiUrl: "https://wbsapi.withings.net",
    clientId: process.env.WITHINGS_CLIENT_ID,
    clientSecret: process.env.WITHINGS_CLIENT_SECRET,
  },
  google: {
    apiKey: process.env.GOOGLE_API_KEY,
  },
  dynamoDb: {
    emailSubscribersTable: "staging-platform-email-subscribers",
    waitlistTable: "staging-platform-waitlist",
  },
  s3: {
    patientBucketName: "staging-platform-patient-storage",
    checkoutBucketName: "staging-platform-checkout-storage",
  },
  ringCentral: {
    clientId: "DiUqEh27Rz-fDuQiez1OdQ",
    number: "+19167582408",
    extension: "101",
  },
  akuteApiUrl: "https://api.staging.akutehealth.com/v1",
  akute: {
    labCorpOrganizationId: "f-4f0235627ac2d59b49e5575c", // testinglab facility
    // labCorpOrganizationId: "f-e20f61500ba128d340068ff6", // labcorp
    procedures: akuteProcedures,
  },
  twilioPhone: "+18447440088",
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    defaultPriceId:
      process.env.STRIPE_DEFAULT_PRICE_ID ?? "price_1KMviXDOjl0X0gOq9Pk7gRFE",
    partnerPriceId:
      process.env.STRIPE_PARTNER_PRICE_ID ?? "price_1KMviXDOjl0X0gOq9Pk7gRFE",
  },
}

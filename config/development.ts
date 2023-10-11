import dotenv from "dotenv"
dotenv.config()

import candidHealth from "./includes/candidHealth.production"
import akuteProcedures from "./includes/akuteProcedures.development"

export default {
  env: "development",
  dbUri: `mongodb+srv://dev_staging:${process.env.DB_PASSWORD}@platform-staging-cluste.zn2qm3z.mongodb.net/?retryWrites=true&w=majority`,
  baseUrl: "https://develop.joinalfie.com",
  easyAppointmentsApiUrl: "https://develop.ea.joinalfie.com/index.php/api/v1",
  sendBirdApiUrl:
    "https://api-D804CA81-FB1D-4078-8A98-B31AE451EAF9.sendbird.com",
  candidHealth: {
    apiUrl: "https://api.joincandidhealth.com/api",
    clientId: process.env.CANDID_CLIENT_ID,
    clientSecret: process.env.CANDID_CLIENT_SECRET,
    serviceTypeCodes: ["90", "3", "30", "BZ"],
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
  dynamoDb: {
    emailSubscribersTable: "develop-platform-email-subscribers",
    waitlistTable: "develop-platform-waitlist",
  },
  s3: {
    patientBucketName: "develop-platform-patient-storage",
    checkoutBucketName: "develop-platform-checkout-storage",
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

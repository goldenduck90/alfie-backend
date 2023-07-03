import dotenv from "dotenv"
dotenv.config()

import candidHealth from "./includes/candidHealth.development"

export default {
  env: "development",
  dbUri: `mongodb+srv://joinalfie_dev_user:${process.env.DB_PASSWORD}@platform-staging-cluste.zn2qm3z.mongodb.net/?retryWrites=true&w=majority`,
  baseUrl: "https://www.staging.joinalfie.com",
  calApiUrl: "https://api.staging.cal.joinalfie.com",
  easyAppointmentsApiUrl:
    process.env.EASY_APPOINTMENTS_API_URL ||
    "http://develop-ea.us-east-1.elasticbeanstalk.com/index.php/api/v1",
  sendBirdApiUrl:
    "https://api-D804CA81-FB1D-4078-8A98-B31AE451EAF9.sendbird.com",
  candidHealth: {
    apiUrl: "https://api-staging.joincandidhealth.com/api",
    clientId: process.env.CANDID_CLIENT_ID,
    clientSecret: process.env.CANDID_CLIENT_SECRET,
    serviceTypeCode: "90",
    settings: candidHealth,
  },
  defaultPriceId: "price_1KMviXDOjl0X0gOq9Pk7gRFE",
  dynamoDb: {
    emailSubscribersTable: "develop-platform-email-subscribers",
    waitlistTable: "develop-platform-waitlist",
  },
  s3: {
    patientBucketName: "develop-platform-patient-storage",
  },
  ringCentral: {
    clientId: "DiUqEh27Rz-fDuQiez1OdQ",
    number: "+19167582408",
    extension: "101",
  },
  akuteApiUrl: "https://api.staging.akutehealth.com/v1",
  akute: {
    // labCorpOrganizationId: "f-e20f61500ba128d340068ff6", // labcorp
    labCorpOrganizationId: "f-4f0235627ac2d59b49e5575c", // testinglab facility
  },
  twilioPhone: "+18447440088",
}

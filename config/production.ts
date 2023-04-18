import dotenv from "dotenv"
dotenv.config()

export default {
  dbUri: `mongodb+srv://joinalfie_dev_user:${process.env.DB_PASSWORD}@platform-production-clu.wnd0f.mongodb.net/?retryWrites=true&w=majority`,
  baseUrl: "https://prod.joinalfie.com",
  easyAppointmentsApiUrl: "https://ea.prod.joinalfie.com/index.php/api/v1",
  sendBirdApiUrl:
    "https://api-56D883B9-B30F-428B-8B7A-31184E513DF4.sendbird.com",
  defaultPriceId: "price_1KMv4hDOjl0X0gOqRIWXpGVz",
  s3: {
    patientBucketName: "production-platform-patient-storage",
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
  },
  twilioPhone: "+18447244465",
}

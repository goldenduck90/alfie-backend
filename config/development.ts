import dotenv from "dotenv"
dotenv.config()

export default {
  dbUri: `mongodb+srv://joinalfie_dev_user:${process.env.DB_PASSWORD}@platform-staging-cluste.zn2qm3z.mongodb.net/?retryWrites=true&w=majority`,
  baseUrl:
    "https://www.staging.joinalfie.com",
  calApiUrl: "https://api.staging.cal.joinalfie.com",
  easyAppointmentsApiUrl:
    "http://develop-ea.us-east-1.elasticbeanstalk.com/index.php/api/v1",
  sendBirdApiUrl:
    "https://api-D804CA81-FB1D-4078-8A98-B31AE451EAF9.sendbird.com",
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
}

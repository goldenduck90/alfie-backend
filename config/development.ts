import dotenv from "dotenv"
dotenv.config()

export default {
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
    serviceTypeCode: "88",
    chargeAmountCents: 20000,
    billingProvider: {
      organization_name: "Alfie",
      tax_id: "000000001",
      npi: "1942788757",
      address: {
        address1: "123 address1",
        address2: "000",
        city: "city2",
        state: "WA",
        zip_code: "37203",
        zip_plus_four_code: "0000",
      },
    },
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
  twilioPhone: "+18447440088",
}

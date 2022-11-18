export default {
  dbUri: `mongodb+srv://joinalfie_dev_user:${process.env.DB_PASSWORD}@platform-staging-cluste.zn2qm3z.mongodb.net/?retryWrites=true&w=majority`,
  baseUrl:
    "http://develop.platform.joinalfie.com.s3-website-us-east-1.amazonaws.com",
  easyAppointmentsApiUrl:
    "http://develop-ea.us-east-1.elasticbeanstalk.com/index.php/api/v1",
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
}

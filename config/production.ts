export default {
  dbUri: `mongodb+srv://joinalfie_dev_user:${process.env.DB_PASSWORD}@platform-staging-cluste.zn2qm3z.mongodb.net/?retryWrites=true&w=majority`,
  baseUrl: "https://platform.joinalfie.com",
  easyAppointmentsApiUrl: "https://ea.joinalfie.com/api/v1",
  stripe: {
    defaultPriceId: "price_1KMv4hDOjl0X0gOqRIWXpGVz",
  },
  s3: {
    patientBucketName: "production-platform-patient-storage",
  },
  ringCentral: {
    number: "+19178934212",
    extension: "101",
  },
}

export default {
  dbUri: `mongodb+srv://joinalfie_dev_user:${process.env.DB_PASSWORD}@platform-staging-cluste.zn2qm3z.mongodb.net/?retryWrites=true&w=majority`,
  baseUrl:
    "http://develop.platform.joinalfie.com.s3-website-us-east-1.amazonaws.com",
  healthieGraphqlUrl: "https://staging-api.gethealthie.com/graphql",
  easyAppointmentsApiUrl: "http://localhost:8082/index.php/api/v1",
  stripe: {
    defaultPriceId: "price_1KMviXDOjl0X0gOq9Pk7gRFE",
  },
  s3: {
    patientBucketName: "develop-platform-patient-storage",
  },
}

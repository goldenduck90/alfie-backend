export default {
  dbUri: `mongodb+srv://joinalfie_dev_user:${process.env.DB_PASSWORD}@platform-staging-cluste.zn2qm3z.mongodb.net/?retryWrites=true&w=majority`,
  baseUrl:
    "http://develop.platform.joinalfie.com.s3-website-us-east-1.amazonaws.com",
  stripe: {
    defaultPriceId: "price_1KMviXDOjl0X0gOq9Pk7gRFE",
  },
}

export default {
  dbUri: `mongodb+srv://joinalfie_dev_user:${process.env.DB_PASSWORD}@platform-production-clu.wnd0f.mongodb.net/?retryWrites=true&w=majority`,
  baseUrl: "https://app.joinalfie.com",
  easyAppointmentsApiUrl: "https://ea.joinalfie.com/api/v1",
  stripe: {
    defaultPriceId: "price_1KMv4hDOjl0X0gOqRIWXpGVz",
  },
  s3: {
    patientBucketName: "production-platform-patient-storage",
  },
  ringCentral: {
    clientId: "L_mex0WgQg6_j-KcMNBAcg",
    number: "+19178934212",
    extension: "101",
  },
}

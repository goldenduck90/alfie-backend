import dotenv from "dotenv"
import { SettingsList } from "../src/utils/calculateSetting"
dotenv.config()

export default {
  dbUri: `mongodb+srv://joinalfie_dev_user:${process.env.DB_PASSWORD}@platform-production-clu.wnd0f.mongodb.net/?retryWrites=true&w=majority`,
  baseUrl: "https://app.joinalfie.com",
  easyAppointmentsApiUrl: "https://ea.prod.joinalfie.com/index.php/api/v1",
  sendBirdApiUrl:
    "https://api-56D883B9-B30F-428B-8B7A-31184E513DF4.sendbird.com",
  candidHealth: {
    apiUrl: "https://api.joincandidhealth.com/api",
    clientId: process.env.CANDID_CLIENT_ID,
    clientSecret: process.env.CANDID_CLIENT_SECRET,
    serviceTypeCode: "3",
    settings: [
      // billing provider selection
      {
        conditions: [{ state: ["NJ", "NY"] }],
        vars: {
          billingProvider: {
            organization_name: "Purple Circle Physician PC",
            tax_id: "87-4295712",
            npi: "1871207555",
            address: {
              address1: "222 Broadway",
              address2: "Floor 22",
              city: "New York",
              state: "NY",
              zip_code: "10038",
              zip_code_plus_four: "2510",
            },
          },
        },
      },
      {
        conditions: [{ state: "FL" }],
        vars: {
          billingProvider: {
            organization_name: "Alfie Health, LLC",
            tax_id: "87-4770650",
            npi: "1497469175",
            address: {
              address1: "222 Broadway",
              address2: "Floor 22",
              city: "New York",
              state: "NY",
              zip_code: "10038",
              zip_code_plus_four: "2510",
            },
          },
        },
      },
      {
        conditions: [{ state: ["DC", "MD", "VA", "TX"] }],
        vars: {
          billingProvider: {
            organization_name: "MIST Health, PC",
            tax_id: "87-4501494",
            npi: "1104538826",
            address: {
              address1: "8403 Colesville Road",
              address2: "Suite 100",
              city: "Silver Spring",
              state: "MD",
              zip_code: "20901",
              zip_code_plus_four: "6246",
            },
          },
        },
      },

      // diagnosis selection
      {
        vars: { diagnosis: "E66.3" },
        conditions: [{ bmi: { range: [27, 30] } }],
      },
      {
        vars: { diagnosis: "E66.9" },
        conditions: [{ bmi: { range: [30, Infinity] } }],
      },

      // cost and procedure selection
      {
        vars: { cost: 16740, procedure: "99204" },
        conditions: [
          {
            initial: true,
            bmi: { range: [30, Infinity] },
            comorbidities: { range: [1, Infinity] },
          },
          {
            initial: true,
            bmi: { range: [27, 30] },
            comorbidities: { range: [2, Infinity] },
          },
        ],
      },
      {
        vars: { cost: 11284, procedure: "99203" },
        conditions: [
          { initial: true, bmi: { range: [30, Infinity] } },
          { initial: true, bmi: { range: [27, 30], comorbidities: [1, 1] } },
        ],
      },
      // cost and procedure for repeat consultations
      {
        vars: { followUpCost: 9082, followUpProcedure: "99213" },
        conditions: [{ initialProcedureCode: "99203" }],
      },
      {
        vars: { followUpCost: 9082, followUpProcedure: "99213" },
        conditions: [{ initialProcedureCode: "99203" }],
      },
    ] as SettingsList,
  },
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
  zapierCreateUserWebhook:
    "https://hooks.zapier.com/hooks/catch/12197313/34bsrhc/",
}

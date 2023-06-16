import { SettingsList } from "../../src/utils/calculateSetting"

export default [
  // billing provider selection
  {
    conditions: [{ state: ["NJ", "NY", "WA", "FL"] }],
    vars: {
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
      // (bmi >30 and 1+ comorbidity) or (bmi >=27, <30 and 2+ comorbidities)
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
      { initial: true, bmi: { range: [27, 30] }, comorbidities: 1 },
    ],
  },

  // cost and procedure for repeat consultations
  {
    vars: { cost: 12843, procedure: "99214" },
    conditions: [{ initial: false, initialProcedureCode: "99204" }],
  },
  {
    vars: { cost: 9082, procedure: "99213" },
    conditions: [{ initial: false, initialProcedureCode: "99203" }],
  },

  // if no initial appointment procedure codes are available
  // on the claim object, use these
  {
    vars: { cost: 12843, procedure: "99214" },
    conditions: [
      {
        initial: false,
        bmi: { range: [30, Infinity] },
        comorbidities: { range: [1, Infinity] },
      },
      {
        initial: false,
        bmi: { range: [27, 30] },
        comorbidities: { range: [2, Infinity] },
      },
    ],
  },
  {
    vars: { cost: 9082, procedure: "99213" },
    conditions: [
      { initial: false, bmi: { range: [30, Infinity] } },
      { initial: false, bmi: { range: [27, 30] }, comorbidities: 1 },
    ],
  },
] as SettingsList

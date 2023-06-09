import { SettingsList } from "../../src/utils/calculateSetting"

export const production = [
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
      { initial: true, bmi: { range: [27, 30] }, comorbidities: 1 },
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
] as SettingsList

export const development = [
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
    vars: { followUpCost: 9082, followUpProcedure: "99213" },
    conditions: [{ initialProcedureCode: "99203" }],
  },
  {
    vars: { followUpCost: 9082, followUpProcedure: "99213" },
    conditions: [{ initialProcedureCode: "99203" }],
  },
] as SettingsList

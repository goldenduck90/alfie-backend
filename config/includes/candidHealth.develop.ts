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
    // overweight
    vars: { diagnosis: "E66.3" },
    conditions: [{ bmi: { range: [27, 30] } }],
  },
  {
    // obese
    vars: { diagnosis: "E66.9" },
    conditions: [{ bmi: { range: [30, Infinity] } }],
  },

  // cost and procedure selection
  {
    // level-4 costs and code for initial appointment
    vars: { cost: 16740, procedure: "99204" },
    conditions: [
      // (bmi >30 and 1+ comorbidity) or (bmi >=27, <30 and 2+ comorbidities)
      {
        source: "appointment",
        initial: true,
        bmi: { range: [30, Infinity] },
        comorbidities: { range: [1, Infinity] },
      },
      {
        source: "appointment",
        initial: true,
        bmi: { range: [27, 30] },
        comorbidities: { range: [2, Infinity] },
      },
    ],
  },
  {
    // level-3 costs and code for initial appointment
    vars: { cost: 11284, procedure: "99203" },
    conditions: [
      { source: "appointment", initial: true, bmi: { range: [30, Infinity] } },
      {
        source: "appointment",
        initial: true,
        bmi: { range: [27, 30] },
        comorbidities: 1,
      },
    ],
  },

  // cost and procedure for repeat consultations
  {
    // first attempt to evaluate follow-up appointment procedure codes by continuing to use
    // the same code (level 3 or level 4, e.g. 99204 in the initial appointment -> 99214 in
    // the follow-up appointment).
    vars: { cost: 12843, procedure: "99214" },
    conditions: [
      { source: "appointment", initial: false, initialProcedureCode: "99204" },
    ],
  },
  {
    vars: { cost: 9082, procedure: "99213" },
    conditions: [
      { source: "appointment", initial: false, initialProcedureCode: "99203" },
    ],
  },

  // if no initial appointment procedure codes are available
  // on the claim object, use these
  {
    // follow-up appointment costs for level-4 patients
    vars: { cost: 12843, procedure: "99214" },
    conditions: [
      {
        source: "appointment",
        initial: false,
        bmi: { range: [30, Infinity] },
        comorbidities: { range: [1, Infinity] },
      },
      {
        source: "appointment",
        initial: false,
        bmi: { range: [27, 30] },
        comorbidities: { range: [2, Infinity] },
      },
    ],
  },
  {
    // follow-up appointment costs for level-3 patients
    vars: { cost: 9082, procedure: "99213" },
    conditions: [
      { source: "appointment", initial: false, bmi: { range: [30, Infinity] } },
      {
        source: "appointment",
        initial: false,
        bmi: { range: [27, 30] },
        comorbidities: 1,
      },
    ],
  },

  // procedure/cost for withings scale measurements
  {
    // the first measurement taken with the scale
    vars: { cost: 1932, procedure: "99453" },
    conditions: [{ source: "scale", firstMeasurement: true }],
  },
  {
    // the 16th measurement taken in the current month with the scale
    vars: { cost: 5015, procedure: "99454" },
    conditions: [{ source: "scale", currentMonthMeasurements: 16 }],
  },
] as SettingsList

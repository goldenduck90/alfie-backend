/** A provider described in a request. */
export interface CandidRequestProviderV0 {
  organization_name?: string
  organizationName?: string
  firstName?: string
  lastName?: string
  npi: string
  serviceProviderNumber?: string
  providerCode?: string
  referenceIdentification?: string
  federalTaxpayersIdNumber?: string
}

/** A subscriber described in a request. */
export interface CandidRequestSubscriberV0 {
  memberId: string
  firstName: string
  lastName: string
  gender: string | "M" | "F"
  dateOfBirth: string
  ssn?: string
}

export interface CandidAddressPlusFour {
  address1: string
  address2?: string
  city: string
  state: string
  zip_code: string
  zip_plus_four_code: string
}
export interface CandidResponseError {
  field: string
  code: string
  description: string
  followupAction: string
  location: string
  possibleResolutions: string
}

export interface CandidMedication {
  name: string
  rx_cui?: string
  dosage?: string
  dosage_form?: string
  frequency?: string
  as_needed?: boolean
}

export interface CandidServiceLine {
  modifiers: string[]

  procedure_code: string

  quantity: string

  /** MJ or UN. */
  units: string

  /** Indices (zero-indexed) of all the diagnoses this service line references. */
  diagnosis_pointers: number[]
}

export interface CandidServiceLineAdjustment {
  created_at: string
  adjustment_group_code?: string
  adjustment_reason_code?: string
  adjustment_amount_cents?: string
  adjustment_note?: string
}

export interface CandidServiceLineResponse {
  modifiers: string[]
  charge_amount_cents?: number
  allowed_amount_cents?: number
  paid_amount_cents?: number
  patient_responsibility_cents?: number
  diagnosis_id_zero?: string
  diagnosis_id_one?: string
  diagnosis_id_two?: string
  diagnosis_id_three?: string
  service_line_era_data: {
    service_line_adjustments: CandidServiceLineAdjustment[]
    remittance_advice_remark_codes: string[]
  }
  service_line_manual_adjustments: CandidServiceLineAdjustment[]
  related_invoices: {
    id: string
    created_at: string
    organization_id: string
    source_id: string
    customer_id: string
    note?: string
    patient_external_id: string
    /** ISO 8601 date; formatted YYYY-MM-DD (i.e. 2012-02-01) */
    due_date: string
    /** Enum: "draft" "open" "paid" "void" "uncollectible" */
    status: string
    url?: string
    customer_invoice_url?: string
    items: {
      service_line_id: string
      amount_cents: number
    }[]
  }
  denial_reason: string | null
  place_of_service_code: string | null
  service_line_id: string
  procedure_code: string
  quantity: string
  units: string
  claim_id: string
}

export interface CandidPlanInformation {
  policyNumber: string
}

export interface CandidPlanDateInformation {
  /** Discharge */
  discharge: string

  /** issue */
  issue: string

  /** effectiveDateOfChange */
  effectiveDateOfChange: string

  /** periodStart */
  periodStart: string

  /** periodEnd */
  periodEnd: string

  /** completion */
  completion: string

  /** coordinationOfBenefits */
  coordinationOfBenefits: string

  /** plan */
  plan: string

  /** benefit */
  benefit: string

  /** primaryCareProvider */
  primaryCareProvider: string

  /** latestVisitOrConsultation */
  latestVisitOrConsultation: string

  /** eligibility */
  eligibility: string

  /** added */
  added: string

  /** cobraBegin */
  cobraBegin: string

  /** cobraEnd */
  cobraEnd: string

  /** premiumPaidToDateBegin */
  premiumPaidToDateBegin: string

  /** premiumPaidToDateEnd */
  premiumPaidToDateEnd: string

  /** planBegin */
  planBegin: string

  /** planEnd */
  planEnd: string

  /** benefitBegin */
  benefitBegin: string

  /** benefitEnd */
  benefitEnd: string

  /** eligibilityBegin */
  eligibilityBegin: string

  /** eligibilityEnd */
  eligibilityEnd: string

  /** enrollment */
  enrollment: string

  /** admission */
  admission: string

  /** dateOfDeath */
  dateOfDeath: string

  /** certification */
  certification: string

  /** service */
  service: string

  /** policyEffective */
  policyEffective: string

  /** policyExpiration */
  policyExpiration: string

  /** dateOfLastUpdate */
  dateOfLastUpdate: string

  /** status */
  status: string
}

export interface CandidContactInformation {
  /** Name */
  name: string

  /** Communication */
  contacts: any[]

  /** Communication Number Qualifier */
  communicationMode: string

  /** Communication Number */
  communicationNumber: string
}

/** Type for the provider field in responses from candid. */
export interface CandidResponseProvider {
  /** Name Last. */
  providerName: string

  /** Name First. */
  providerFirstName: string

  /** Organization Name. */
  providerOrgName?: string

  /** Name Middle. */
  middleName?: string

  /** suffix. */
  suffix?: string

  /** Entity Identifier Code, e.g. Provider */
  entityIdentifier: string

  /** Entity Type Qualifier, e.g. Person */
  entityType: string

  /** National Provider Identifier. */
  npi: string

  /** Provider Code. */
  providerCode?: string

  /** Reference Identification. */
  referenceIdentification?: string

  /** Employer's Identification Number. */
  employersId?: string

  /** Social Security Number. */
  ssn?: string

  /** Federal Taxpayer's Identification Number. */
  federalTaxpayersIdNumber?: string

  /** Payor Identification. */
  payorIdentification?: string

  /** Pharmacy Processor Number. */
  pharmacyProcessorNumber?: string

  /** Service Provider Number. */
  serviceProviderNumber?: string

  /** Services PlanID. */
  servicesPlanID?: string

  /** The provider's address. */
  address?: CandidAddress
}
export interface CandidAddress {
  /** Required, Address Information. */
  address1: string

  /** Address Information. */
  address2: string

  /** Required, city. */
  city: string

  /** state example: TN, WA. */
  state: string

  /** Segment: N4, Element: N403. */
  postalCode: string

  /** Segment: N4, Element: N404. */
  countryCode: string

  /** Segment: N4, Element: N406. */
  locationIdentifier: string

  /** Country SubDivision Code. */
  countrySubDivisionCode: string
}

export interface CandidEncounterV0 {
  /**
   * Date of service in YYYYMMDD pattern.
   * beginningDateOfService and endDateOfService must be omitted if this field is specified.
   * While this field is optional, service date(s) must be specified by one of the mechanisms.
   */
  dateOfService?: string

  /**
   * Date service began in YYYYMMDD pattern.
   * endDateOfService must be specified and dateOfService must be omitted if this field is specified.
   * While this field is optional, service date(s) must be specified by one of the mechanisms.
   */
  beginningDateOfService?: string
  endDateOfService?: string

  /**
   * For Alfie, uses 99 - Bariatric services - Services that deal with the causes, education, prevention and treatment of obesity.
   * @see https://x12.org/codes/service-type-codes
   */
  serviceTypeCodes: string[]
}

export interface CandidEligibilityCheckRequest {
  /** The CPID of the insurance company (payer). */
  tradingPartnerServiceId: string
  // tradingPartnerServiceId: string

  /** The provider. */
  provider: CandidRequestProviderV0

  /** The subscriber/patient. */
  subscriber: CandidRequestSubscriberV0

  /** The encounter (medical service). */
  encounter?: CandidEncounterV0
}

export interface CandidEligibilityCheckResponse {
  /** Meta data about the response. */
  meta: {
    /** Sender id assigned to this request. */
    senderId: string

    /** Submitter id assigned to this request. */
    submitterId?: string

    /** Billing id assigned to this request. */
    billerId: string

    /** Used by Change Healthcare to identify where this request can be found for support. */
    applicationMode: string

    /** Unique Id assigned to each request by Change Healthcare. */
    traceId: string

    /** BHT03 Value for submitterTransactionIdentifier. */
    outboundTraceId?: string
  }

  /** Interchange Control Number original request. */
  controlNumber: string

  /** Interchange Control Number. */
  reassociationKey: string

  /** This property is a feature of Trading Partner API. */
  tradingPartnerId?: string

  /** This is the payorId or Identification Code that was sent in the 270. */
  tradingPartnerServiceId: string

  /** The provider. */
  provider: CandidResponseProvider

  /** The subscriber. */
  subscriber: {
    /** Diagnosis codes. */
    healthCareDiagnosisCodes: {
      /** Diagnosis type code, e.g. "BK", or "BF". */
      diagnosisTypeCode: string
      /** Diagnosis code, e.g. 8901. */
      diagnosisCode: string
    }[]

    /** Member Identification Number. */
    memberId: string

    /** First Name. */
    firstName: string

    /** Last Name. */
    lastName: string

    /** Middle Name. */
    middleName?: string

    /** suffix. */
    suffix?: string

    /** Gender, M or F. */
    gender: string

    /** Entity identifie, e.g. Insured or Subscriber */
    entityIdentifier: string

    /** Entity type, e.g. Person */
    entityType: string

    /** Whether the person is insured; "Y". */
    insuredIndicator: string

    /** Date of Birth in YYYYMMDD format. */
    dateOfBirth: string

    /** Individual Relationship Code, e.g. Self */
    relationToSubscriber: string

    /** Maintenance Type Code. */
    maintenanceTypeCode: string

    /** Maintenance Reason Code. */
    maintenanceReasonCode: string

    /** Birth Sequence Number Use to indicate the birth order in the event of multiple births in association with the birth date supplied in DMG02. */
    birthSequenceNumber: string

    responseProvider: CandidResponseProvider
  }

  subscriberTraceNumbers: {
    traceTypeCode: string
    traceType: string
    referenceIdentification: string
    originatingCompanyIdentifier: string
  }

  payer: {
    /** Entity Identifier Code */
    entityIdentifier: string

    /** Entity Type Qualifier */
    entityType: string

    /** Organization Name */
    name: string

    /** Payor Identification */
    payorIdentification: string
  }

  planInformation: CandidPlanInformation

  planStatus: {
    /** E.g. "1" for active coverage. */
    statusCode: string

    /** Status, e.g. Active Coverage */
    status: string

    /** Information on the plan. */
    planDetails: string

    /** Service type codes indicating what is covered. */
    serviceTypeCodes: string[]
  }[]

  benefitsInformation: {
    /** E.g. "1" for active coverage. */
    code: string
    /** E.g. Active Coverage */
    name: string
    /** A list of codes covered. */
    serviceTypeCodes: string[]
    /** A list of service types. */
    serviceTypes: string[]
    /** Information on the plan. */
    planCoverage?: string
    benefitsAdditionalInformation?: {
      planNumber: string
      drugFormularyNumber: string
      planNetworkIdNumber: string
    }
    benefitsDateInformation?: {
      /** YYYYMMDD format. */
      plan: string
    }
  }[]

  x12: string
}

export interface CandidCreateCodedEncounterRequest {
  /** A client-specified unique ID to associate with this encounter; for example, your internal encounter ID or a Dr. Chrono encounter ID. This field should not contain PHI. */
  external_id: string

  /** ISO 8601 date; eg: 2019-08-24. This date must be the local date in the timezone where the service occurred. Box 24a on the CMS-1500 claim form. If service occurred over a range of dates, this should be the start date. */
  date_of_service: string

  /** ISO 8601 date; eg: 2019-08-25. This date must be the local date in the timezone where the service occurred. If omitted, the Encounter is assumed to be for a single day. Must not be temporally before the date_of_service field. */
  end_date_of_service?: string

  /** Box 23 on the CMS-1500 claim form. */
  prior_authorization_number?: string

  /** Whether this patient has authorized the release of medical information for billing purpose. Box 12 on the CMS-1500 claim form. */
  patient_authorized_release: boolean

  /** Whether this patient has authorized insurance payments to be made to you, not them. If false, patient may receive reimbursement. Box 13 on the CMS-1500 claim form. */
  benefits_assigned_to_provider: boolean

  /** Whether you have accepted the patient's authorization for insurance payments to be made to you, not them. Box 27 on the CMS-1500 claim form. */
  provider_accepts_assignment: boolean

  /** Human-readable description of the appointment time (ex: "Acupuncture - Headaches") */
  appointment_type?: string

  /** Should be set to true if Candid should not create or submit a claim but you'd like us to track this encounter anyway (ex: patient is paying cash) */
  do_not_bill?: boolean

  /**
   * The billing provider is the provider or business entity submitting
   * the claim. Billing provider may be, but is not necessarily, the same
   * person/NPI as the rendering provider. From a payer's perspective, this
   * represents the person or entity being reimbursed. When a contract exists
   * with the target payer, the billing provider should be the entity
   * contracted with the payer. In some circumstances, this will be an
   * individual provider. In that case, submit that provider's NPI and the
   * tax ID (TIN) that the provider gave to the payer during contracting.
   * In other cases, the billing entity will be a medical group. If so,
   * submit the group NPI and the group's tax ID. Box 33 on the CMS-1500
   * claim form.
   */
  billing_provider: {
    /** If the billing provider is an individual, this should be set instead of organization name. */
    first_name?: string

    /** If the billing provider is an individual, this should be set instead of organization name. */
    last_name?: string

    /** If the billing provider is an organization, this should be set instead of first + last name. */
    organization_name?: string

    address: {
      address1: string
      address2?: string
      city: string
      state: string
      zip_code: string
      zip_plus_four_code: string
    }

    /** If the provider has a contract with insurance, this must be the same tax ID given to the payer on an IRS W-9 form completed during contracting. */
    tax_id: string

    npi: string

    taxonomy_code?: string
  }

  /** For telehealth services, the rendering provider performs the visit, asynchronous communication, or other service. The rendering provider address should generally be the same as the service facility address. */
  rendering_provider: {
    /** If the billing provider is an individual, this should be set instead of organization name. */
    first_name?: string

    /** If the billing provider is an individual, this should be set instead of organization name. */
    last_name?: string

    /** If the billing provider is an organization, this should be set instead of first + last name. */
    organization_name?: string

    address?: {
      address1: string
      address2?: string
      city: string
      state: string
      zip_code: string
      zip_plus_four_code: string
    }

    /** A National Provider Identifier is a unique 10-digit identification numberissued to health care providers in the United States. */
    npi: string

    taxonomy_code?: string
  }

  /**
   * Encounter Service facility is typically the location a medical service was rendered, such as a provider office or hospital. For telehealth, service facility can represent the provider's location when the service was delivered (e.g., home), or the location where an in-person visit would have taken place, whichever is easier to identify. If the provider is in-network, service facility may be defined in payer contracts. Box 32 on the CMS-1500 claim form.
   * Default: { "organization_name": "UNSET", "address": { "address1": "UNSET", "address2": "UNSET", "city": "UNSET", "state": "AA", "zip_code": "00000", "zip_plus_four_code": "0000" } }
   */
  service_facility?: {
    /** Default: "UNSET" */
    organization_name: string

    address: CandidAddressPlusFour
  }

  pay_to_address?: CandidAddressPlusFour

  patient: {
    first_name: string
    last_name: string
    /** Enum: male, female, other, not_given, unknown */
    gender: string
    /** Another ID you want to associate with this patient. For example, your internal patient ID or a Dr. Chrono patient ID. Box 1a on the CMS-1500 claim form. */
    external_id: string
    /** Box 3 on the CMS-1500 claim form. The date format should be in ISO 8601 date; formatted YYYY-MM-DD (i.e. 2012-02-01). */
    date_of_birth: string
    address: CandidAddressPlusFour
  }

  /** Please always include this when you have it, even for cash-only claims. Must be included when do_not_bill is False. */
  subscriber_primary?: {
    first_name: string
    last_name: string
    /** Enum: male, female, other, not_given, unknown */
    gender: string
    /**
     * Enum: "01" "04" "05" "07" "10" "15" "17" "18" "19" "20" "21" "22" "23" "24" "29" "32" "33" "36" "39" "40" "41" "43" "53" "G8".
     * PAT01 Patient Relationship to Insured codes:
     * 01 - Spouse, 04 - Grandparent, 05 - Grandchild, 05 - Niece or nephew, 10 - Foster child, 15 - Ward of the court, 17 - Stepchild,
     * 18 - Self, 19 - Child, 20 - Employee, 21 - Unknown, 22 - Handicapped dependent, 23 - Sponsored dependent,
     * 24 - Dependent of minor dependent, 29 - Significant other, 32 - Mother, 33 - Father, 36 - Emancipated minor, 39 - Organ Donor,
     * 40 - Cadaver Donor, 41 - Injured plaintiff, 43 - Natural Child, insured does not have financial responsibility, 53 - Life Partner,
     * G8 - Other Relationship
     */
    patient_relationship_to_subscriber_code: string

    address?: CandidAddressPlusFour

    insurance_card: {
      group_number?: string
      plan_name?: string
      /**
       * Enum: "09" "11" "12" "13" "14" "15" "16" "17" "AM" "BL" "CH" "CI" "DS" "FI" "HM" "LM" "MA" "MB" "MC" "OF" "TV" "VA" "WC"
       * 09 - Self-pay, 11 - Other Non-Federal Programs, 12 - Preferred Provider Organization (PPO), 13 - Point of Service (POS),
       * 14 - Exclusive Provider Organization (EPO), 15 - Indemnity Insurance, 16 - Health Maintenance Organization (HMO) Medicare Risk,
       * 17 - Dental Maintenance Organization, AM - Automobile Medical, BL - Blue Cross/Blue Shield, CH - CHAMPUS, CI - Commercial Insurance Co.,
       * DS - Disability, FI - Federal Employees Program, HM - Health Maintenance Organization (HMO), LM - Liability Medical, MA - Medicare Part A,
       * MB - Medicare Part B, MC - Medicaid, OF - Other Federal Program, TV - Title V, VA - Veterans Affairs Plan,
       * WC - Workers' Compensation Health Claim, ZZ - Mutually Defined, insurance_type	, string (Insurance Type) non-empty
       */
      plan_type?: string

      member_id: string
      payer_name: string
      payer_id: string
      rx_bin?: string
      rx_pcn?: string
      image_url_front?: string
      image_url_back?: string
      /**
       * Enum: "CANVAS" "HEALTHIE"
       *
       * Candid's API generally validates that the payer ID send on an insurance card is a valid national payer id.
       * If you are submitting insurance information from an EMR which uses something other than the national payer ID,
       * you can provide this optional to convert the payer ID you send to the national payer ID. This conversion happens
       * transparently, and Candid saves the converted national payer ID and name on the insurance card, not the payer ID
       * and name provided in the API call.
       */
      emr_payer_crosswalk?: string
    }
  }

  /** No more than 12 may be submitted for coded Encounters. */
  diagnoses: {
    name?: string
    /** Should be of the appropriate format for the provided code_type. Must obey the ICD-10 format if an ICD-10 code_type is provided. */
    code: string
    /**
     * Enum: "ABF" "ABJ" "ABK" "APR" "BF" "BJ" "BK" "PR" "DR" "LOI"
     * Typically, providers submitting claims to Candid are using ICD-10 diagnosis codes. If you are using ICD-10 codes, the primary diagnosis code listed on the claim should use the ABK code_type. If more than one diagnosis is being submitted on a claim, please use ABF for the rest of the listed diagnoses. If you are using ICD-9 diagnosis codes, use BK and BF for the principal and following diagnosis code(s) respectively.
     */
    code_type: string
  }[]

  /** Can be used to send clinical notes in the case that Candid is reviewing your coding using your notes. */
  clinical_notes?: {
    /** Enum: "clinical" "care_plan" "diagnoses" "vitals" "physical_exam" "review_of_systems" "medical_decisions" "history_of_present_illness" "patient_info" "chief_complaint" "health_record" "consent" "procedure" "time_in_appointment". */
    category: string
    notes: {
      text: string
      author_name: string
      author_npi?: string
      /** ISO 8601 timestamp. */
      timestamp: string
    }[]
  }[]

  /** Spot to store misc, human - readable, notes about this encounter to be used in the billing process. */
  billing_notes?: {
    text: string
  }[]

  /**
   * Enum: "01" "02" "03" "04" "05" "06" "07" "08" "09" "10" "11" "12" "13" "14" "15" "16" "17" "18" "19" "20" "21" "22" "23" "24" "25" "26" "31" "32" "33" "34" "41" "42" "49" "50" "51" "52" "53" "54" "55" "56" "57" "58" "60" "61" "62" "65" "71" "72" "81" "99"
   * Box 24B on the CMS - 1500 claim form.Line - level place of service is not currently supported.02 for telemedicine, 11 for in -person.Full list here: https://www.cms.gov/Medicare/Coding/place-of-service-codes/Place_of_Service_Code_Set
   */
  place_of_service_code: string

  /** Each service line must be linked to a diagnosis.Concretely, service_line.diagnosis_pointers must contain at least one entry which should be in bounds of the diagnoses list field */
  service_lines: CandidServiceLine[]

  /** Whether or not this was a synchronous or asynchronous encounter. Asynchronous encounters occur when providers and patients communicate online using forms, instant messaging, or other pre - recorded digital mediums.Synchronous encounters occur in live, real - time settings where the patient interacts directly with the provider, such as over video or a phone call. Enum: "Synchronous" "Asynchronous" */
  synchronicity?: string
}

export interface CandidEncodedEncounterResponse {
  /** A client-specified unique ID to associate with this encounter; for example, your internal encounter ID or a Dr. Chrono encounter ID. This field should not contain PHI. */
  external_id: string
  /** ISO 8601 date; eg: 2019-08-24. This date must be the local date in the timezone where the service occurred. Box 24a on the CMS-1500 claim form. If service occurred over a range of dates, this should be the start date. */
  date_of_service: string
  /** ISO 8601 date; eg: 2019-08-25. This date must be the local date in the timezone where the service occurred. If omitted, the Encounter is assumed to be for a single day. Must not be temporally before the date_of_service field. */
  end_date_of_service: string | null
  /** Box 23 on the CMS-1500 claim form. */
  prior_authorization_number: string | null
  /** Whether this patient has authorized the release of medical information for billing purpose. Box 12 on the CMS-1500 claim form. */
  patient_authorized_release: boolean
  /** Whether this patient has authorized insurance payments to be made to you, not them. If false, patient may receive reimbursement. Box 13 on the CMS-1500 claim form. */
  benefits_assigned_to_provider: boolean
  /** Whether you have accepted the patient's authorization for insurance payments to be made to you, not them. Box 27 on the CMS-1500 claim form. */
  provider_accepts_assignment: boolean
  /** Human-readable description of the appointment time (ex: "Acupuncture - Headaches") */
  appointment_type: string
  /** Should be set to true if Candid should not create or submit a claim but you'd like us to track this encounter anyway (ex: patient is paying cash) */
  do_not_bill: boolean
  existing_medications: CandidMedication[]
  vitals: null | {
    height_in: number
    weight_lbs: number
    blood_pressure_systolic_mmhg: number
    blood_pressure_diastolic_mmhg: number
    body_temperature_f: number
  }
  interventions: {
    name: string
    /** Enum: "allopathic" "naturopathic" "tests" "lifestyle". An enumeration. */
    category: string
    description?: string
    medication: CandidMedication[]
    /** Required when `type` is `tests`. */
    labs: {
      name: string
      code?: string
      /** Enum: "quest" "labcorp". An enumeration. */
      code_type?: string
    }[]
  }[]
  pay_to_address: null | CandidAddressPlusFour
  synchronicity: string | null
  encounter_id: string
  assigned_to_id: string | null
  claims: {
    claim_id: string
    /** Enum: "biller_received" "coded" "submitted_to_payer" "missing_information" "not_billable" "waiting_for_provider" "era_received" "rejected" "denied" "paid" "paid_incorrectly" "finalized_paid" "finalized_denied" "held_by_customer" */
    status: string
    clearinghouse?: string
    clearinghouse_claim_id?: string
    payer_claim_id: string | null
    service_lines: CandidServiceLineResponse[]
    eras: []
  }[]
  patient: {
    first_name: string
    last_name: string
    gender: string
    /** The MongoDB user _id. */
    external_id: string
    /** YYYY-MM-DD */
    date_of_birth: string
    address: {
      address1: string
      address2?: string
      city: string
      state: string
      zip_code: string
      zip_plus_four_code: string
    }
    individual_id: string
  }
  billing_provider: {
    first_name?: string
    last_name?: string
    organization_name: string
    provider_id: string
    address: {
      address1: string
      address2?: string
      city: string
      state: string
      zip_code: string
      zip_plus_four_code: string
    }
    tax_id: string
    npi: string
    taxonomy_code?: string
  }
  rendering_provider: {
    first_name: string
    last_name: string
    organization_name?: string
    provider_id: string
    address: {
      address1: string
      address2?: string
      city: string
      state: string
      zip_code: string
      zip_plus_four_code: string
    }
    tax_id?: string
    npi: string
    taxonomy_code?: string
  }
  referring_provider: any // TODO
  service_facility: {
    service_facility_id: string
    organization_name: string
    address: {
      address1: string
      address2: string
      city: string
      state: string
      zip_code: string
      zip_plus_four_code: string
    }
  }
  subscriber_primary: {
    first_name: string
    last_name: string
    gender: string
    patient_relationship_to_subscriber_code: string
    date_of_birth: null
    address: CandidAddressPlusFour
    individual_id: string
    insurance_card: {
      group_number: string
      plan_name?: string
      plan_type?: string
      insurance_type?: string
      insurance_card_id: string
      member_id: string
      payer_name: string
      payer_id: string
      rx_bin: string
      rx_pcn?: string
      image_url_front?: string
      image_url_back?: string
    }
  }

  subscriber_secondary: any // TODO
  /** The claim URL. */
  url: string
  diagnoses: [
    {
      name?: string
      code: string
      code_type: string
      encounter_id: string
      diagnosis_id: string
      created_at: string
      updated_at: string
    }
  ]
  /** Enum: "clinical" "care_plan" "diagnoses" "vitals" "physical_exam" "review_of_systems" "medical_decisions" "history_of_present_illness" "patient_info" "chief_complaint" "health_record" "consent" "procedure" "time_in_appointment" */
  clinical_notes: {
    category: string
    notes: string[]
    notes_structured: {
      text: string
      author_name: string
      author_npi?: string
      timestamp: string
    }[]
  }[]
  billing_notes: {
    text: string
    billing_note_id: string
    encounter_id: string
    created_at: string
    author_auth0_id?: string
    author_name?: string
  }[]
  place_of_service_code: string
  place_of_service_code_as_submitted?: string
  patient_histories: {
    /** Enum: "present_illness" "medical" "family" "social" */
    category: string
    questions: {
      id: string
      text: string
      responses?: {
        response?: string
        follow_ups: {
          id: string
          text: string
          response?: string
        }[]
      }[]
    }[]
  }[]
  patient_payments: {
    /** Enum: "MANUAL_ENTRY" "CHARGEBEE_PAYMENTS" "CHARGEBEE MANUALLY VOIDED BY CANDID" "CHARGEBEE_REFUNDS" "SQUARE_REFUNDS" "SQUARE_PAYMENTS" "STRIPE_CHARGES" "STRIPE_REFUNDS" "ELATION_PAYMENTS" */
    source: string
    amount_cents: number
    payment_timestamp?: string
    /** Enum: "PENDING" "paid" "CANCELED" "voided" "FAILED" "COMPLETED" "succeeded" "pending" "failed" "requires_action" "canceled" */
    status?: string
    payment_name?: string
    payment_note?: string
    encounter_id: string
    patient_payment_id: string
    organization_id: string
    source_internal_id: string
    service_line_id?: string
  }[]
  tags: {
    tag_id: string
    description: string
    color: string
    creator_id: string
  }[]
  /** Enum: "CANDID" "CUSTOMER" "TCN" */
  coding_attribution: string
  work_queue?: string
}

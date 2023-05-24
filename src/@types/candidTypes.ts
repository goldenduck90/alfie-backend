export interface CandidProviderV0 {
  organizationName?: string
  firstName?: string
  lastName?: string
  npi: string
  serviceProviderNumber?: string
  providerCode?: string
  referenceIdentification?: string
  federalTaxpayersIdNumber?: string
}

export interface CandidSubscriberV0 {
  memberId: string
  firstName: string
  lastName: string
  gender: string | "M" | "F"
  dateOfBirth: string
  ssn?: string
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

  /** The provider. */
  provider: CandidProviderV0

  /** The subscriber/patient. */
  subscriber: CandidSubscriberV0

  /** The encounter (medical service). */
  encounter?: CandidEncounterV0
}

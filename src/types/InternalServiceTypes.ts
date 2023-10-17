import { InsuranceDetails } from "../schema/insurance.schema"
import { Address } from "./../schema/user.schema"

export interface PatientReassignInput {
    patientId: string
    newProviderId: string
  }
  
  export interface BulkPatientReassignInput {
    patientIds: string[]
    newProviderId: string
  }
  
  export interface PatientModifyInput {
    patientId: string
    name: string
    dateOfBirth: Date
    email: string
    phoneNumber: string
    gender: string
    address: Address
    insurance?: InsuranceDetails
  }
  
  export interface ProviderModifyInput {
    providerId: string
    firstName: string
    lastName: string
    email: string
    npi: string
    licensedStates: string[]
    providerCode: string
  }
  
  export interface ProviderCreateInput {
    firstName: string
    lastName: string
    email: string
    npi: string
    licensedStates: string[]
    providerCode: string
  }
  
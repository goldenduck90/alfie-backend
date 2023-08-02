import { ApolloError } from "apollo-server-errors"
import { Address, Insurance, UserModel } from "./../schema/user.schema"
interface PatientReassignInput {
  patientId: string
  newProviderId: string
}

interface BulkPatientReassignInput {
  patientIds: string[]
  newProviderId: string
}

interface PatientModifyInput {
  patientId: string
  name: string
  dateOfBirth: Date
  email: string
  phoneNumber: string
  gender: string
  address: Address
  insurance: Insurance
}

interface ProviderModifyInput {
  providerId: string
  firstName: string
  lastName: string
  email: string
  npi: string
  licensedStates: string[]
  providerCode: string
}

interface ProviderCreateInput {
  firstName: string
  lastName: string
  email: string
  npi: string
  licensedStates: string[]
  providerCode: string
}

class InternalOperationsService {
  async internalPatientReassign(input: PatientReassignInput) {
    try {
      const { patientId, newProviderId } = input
      if (!patientId) {
        throw new ApolloError("Patient Id is required")
      }
      const reassignedPatient = await UserModel.updateOne({
        where: patientId,
        set: {
          provider: newProviderId,
        },
      })
      return reassignedPatient
    } catch (e) {
      throw new ApolloError(
        "An error occurred while reassigning the patient to the new provider"
      )
    }
  }
  async internalBulkPatientReassign(input: BulkPatientReassignInput) {
    try {
      const { patientIds, newProviderId } = input
      if (!patientIds) {
        throw new ApolloError("Patient Ids are required")
      }
      const reassignedPatients = await UserModel.updateMany({
        where: {
          id: {
            $in: patientIds,
          },
        },
        set: {
          provider: newProviderId,
        },
      })
      return reassignedPatients
    } catch (e) {
      throw new ApolloError(
        "An error occurred while reassigning the patient to the new provider"
      )
    }
  }

  async internalPatientModify(input: PatientModifyInput) {
    try {
      const {
        name,
        dateOfBirth,
        email,
        phoneNumber,
        gender,
        address: { line1, city, state, postalCode },
        insurance: {
          memberId,
          insuranceCompany,
          groupId,
          groupName,
          rxBIN,
          rxGroup,
          payor,
        },
      } = input
      const modifiedPatient = await UserModel.updateOne({
        where: input.patientId,
        set: {
          name,
          dateOfBirth,
          email: email.toLowerCase(),
          phoneNumber,
          gender,
          address: {
            line1,
            state,
            postalCode,
            city,
          },
          insurance: {
            memberId,
            insuranceCompany,
            groupId,
            groupName,
            rxBIN,
            rxGroup,
            payor,
          },
        },
      })
      return modifiedPatient
    } catch (e) {
      throw new ApolloError("An error occurred while modifying the patient")
    }
  }
  async internalOpsModifyProvider(input: ProviderModifyInput) {
    try {
      const {
        firstName,
        lastName,
        email,
        npi,
        licensedStates,
        providerCode,
        providerId,
      } = input
      const modifiedProvider = await UserModel.updateOne({
        where: providerId,
        set: {
          firstName,
          lastName,
          email: email.toLowerCase(),
          npi,
          licensedStates,
          providerCode,
        },
      })
      return modifiedProvider
    } catch (e) {
      throw new ApolloError("An error occurred while modifying the provider")
    }
  }
  async internalOpsCreateNewProvider(input: ProviderCreateInput) {
    try {
      const { firstName, lastName, email, npi, licensedStates, providerCode } =
        input
      const newProvider = await UserModel.create({
        firstName,
        lastName,
        email: email.toLowerCase(),
        npi,
        licensedStates,
        providerCode,
      })
      return newProvider
    } catch (e) {
      throw new ApolloError("An error occurred while creating the provider")
    }
  }
}
export default InternalOperationsService

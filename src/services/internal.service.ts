import { UserTaskModel } from "./../schema/task.user.schema"
import { ProviderModel } from "./../schema/provider.schema"
import { TaskModel } from "./../schema/task.schema"
import { ApolloError } from "apollo-server-errors"
import { UserModel } from "./../schema/user.schema"
import { PatientReassignInput, BulkPatientReassignInput, PatientModifyInput, ProviderModifyInput, ProviderCreateInput } from "../types/InternalServiceTypes"


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
      const reassignedPatients = await UserModel.updateMany(
        { _id: { $in: patientIds } },
        { provider: newProviderId }
      )
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
          groupId,
          groupName,
          rxBIN,
          rxGroup,
          payorId,
          payorName,
          insurance,
          status,
        },
      } = input

      const modifiedPatient = await UserModel.findByIdAndUpdate(
        input.patientId,
        {
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
            insurance,
            groupId,
            groupName,
            rxBIN,
            rxGroup,
            payorId,
            payorName,
            status,
          },
        }
      )

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
  async internalFindAllPatients() {
    try {
      const patients = await UserModel.find({ role: "Patient" })
      return patients
    } catch (e) {
      throw new ApolloError("An error occurred while fetching the patients")
    }
  }
  async internalFindPatientById(patientId: string) {
    try {
      const patient = await UserModel.findById(patientId)
      return patient
    } catch (e) {
      throw new ApolloError("An error occurred while fetching the patient")
    }        
  }
  async internalGetAllTaskTypes() {
    try {
      const taskTypes = await TaskModel.find()
      return taskTypes
    } catch (e) {
      throw new ApolloError("An error occurred while fetching the task types")
    }
  }
  async internalGetProviderById(providerId: string) {
    try {
      const provider = await ProviderModel.findById(providerId)
      return provider
    } catch (e) {
      throw new ApolloError("An error occurred while fetching the provider")
    }
  }
  async internalGetAllProviders() {
    try {
      const providers = await ProviderModel.find({ role: "Practitioner"})
      return providers
    } catch (e) {
      throw new ApolloError("An error occurred while fetching the providers")
    }
  }
  async internalGetUserTasksByPatientId(patientId: string) {
    try {
      const tasks = await UserTaskModel.find({ patientId })
      return tasks
    } catch (e) {
      throw new ApolloError("An error occurred while fetching the tasks")
    }
  }
}
export default InternalOperationsService

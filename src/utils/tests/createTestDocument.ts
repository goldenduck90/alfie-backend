import Role from "../../schema/enums/Role"
import { Provider, ProviderModel } from "../../schema/provider.schema"
import { Gender, User, UserModel } from "../../schema/user.schema"
import { randomInt } from "../statistics"

/** Gets a test provider, creating one if necessary. */
export const getTestProvider = async (provider?: Partial<Provider>) => {
  const existingProvider = provider
    ? await ProviderModel.findOne(
        provider.email ? { email: provider.email } : {}
      )
    : null

  if (existingProvider) {
    return existingProvider
  } else {
    const params = {
      email: generateTestEmail(),
      firstName: "Providertest",
      lastName: generateTestName().split(" ")[1],
      type: Role.Doctor,
      npi: `${randomInt(1e9, 1e10)}`,
      licensedStates: ["FL", "NY", "MD"],
      akuteId: "akute-id",
      eaProviderId: 2,
      ...(provider ?? {}),
    }
    const newProvider = await ProviderModel.create(params)

    return newProvider
  }
}

/** Creates a test user with the given information. */
export const createTestUser = async (user?: Partial<User>) => {
  const provider = await getTestProvider()

  const newUser = await UserModel.create({
    name: generateTestName(),
    email: generateTestEmail(),
    dateOfBirth: new Date(1980, 3, 3),
    gender: Object.keys(Gender)[randomInt(0, 2)],
    address: {
      line1: "123 Test Street",
      city: "Test Ciy",
      state: "FL",
      postalCode: "34111",
      country: "USA",
    },
    weightInLbs: 300,
    weights: [{ date: new Date(), value: 300 }],
    heightInInches: 70,
    provider: provider._id,
    textOptIn: false,
    ...(user ?? {}),
  })

  return newUser
}

export const deleteTestUser = async (userId: string) => {
  await UserModel.deleteOne({ _id: userId })
}

export const generateTestEmail = () =>
  `test-user-${Math.floor(Math.random() * 1000)}@joinalfie.com`

export const generateTestName = () =>
  `User A${Math.floor(Math.random() * 1000)}`

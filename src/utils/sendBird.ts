import * as Sentry from "@sentry/node"
import axios from "axios"
import config from "config"
import { Role, UserModel } from "../schema/user.schema"
import { Channel, Member, Message } from "./sendbirdtypes"
import { Provider, ProviderModel } from "../schema/provider.schema"
import batchAsync from "./batchAsync"

const sendbirdBatchSize = 10

export const sendBirdInstance = axios.create({
  baseURL: config.get("sendBirdApiUrl"),
  headers: {
    "Content-Type": "application/ json; charset = utf8",
    "Api-Token": process.env.SENDBIRD_API_TOKEN,
  },
})

/**
 * Returns the typed sendbird entity for the given url.
 */
export const getSendBirdEntity = async <T>(
  url: string,
  params: Record<string, any> = {},
  errorMessage?: string
): Promise<T> => {
  try {
    const { data } = await sendBirdInstance.get(url, { params })
    return data
  } catch (error) {
    if (errorMessage) {
      console.error(errorMessage, error)
    }
    Sentry.captureException(error)
    return null
  }
}

/**
 * Creates a sendbird entity with the given url and parameters, returning the object.
 */
export const createSendBirdEntity = async <T>(
  url: string,
  params: Record<string, any> = {},
  errorMessage?: string
): Promise<T> => {
  try {
    const { data } = await sendBirdInstance.post(url, params)
    return data
  } catch (error) {
    if (errorMessage) {
      console.error(errorMessage, error)
    }
    Sentry.captureException(error)
    return null
  }
}

/**
 * Deletes a sendbird entity with the given url and parameters.
 */
export const deleteSendBirdEntity = async (url: string) => {
  try {
    const result = await sendBirdInstance.delete(url)
    const { status, data } = result
    if (status >= 300) {
      console.error(`Error deleting sendbird entity with url ${url}`, data)
    }
  } catch (error) {
    Sentry.captureException(error)
  }
}

/**
 * Returns a sendbird collection, typed with the passed generic type
 * @template T The type of the element in the result.
 * @template R The type of the result data if `field` is null.
 * @param field The field on the data object to return (e.g. 'users').
 */
export const getSendBirdCollection = async <T>(
  url: string,
  field: string,
  params: Record<string, any> = {},
  errorMessage?: string
): Promise<T[]> => {
  const data = await getSendBirdEntity<any>(url, params, errorMessage)
  if (data && data[field]) {
    return data[field]
  } else {
    return []
  }
}

/** Get all items from a paged sendbird collection. */
export const getPagedSendBirdCollection = async <T>(
  url: string,
  field: string,
  params: Record<string, any> = {},
  errorMessage?: string
): Promise<T[]> => {
  let next: string | null = null
  const result: T[] = []
  do {
    const data = (await getSendBirdEntity<any>(
      url,
      { ...params, limit: 100, token: next || undefined },
      errorMessage
    )) as any
    const items: T[] = data[field]
    result.push(...items)
    next = data.next as string
  } while (next)

  return result
}

/**
 * Finds and returns the User sendbird obect for the given user_id.
 */
export const findSendBirdUser = async (user_id: string): Promise<Member> =>
  await getSendBirdEntity<Member>(`/v3/users/${user_id}`)

/**
 * Deletes a sendbird user by user_id.
 */
export const deleteSendBirdUser = async (user_id: string) =>
  await deleteSendBirdEntity(`/v3/users/${user_id}`)

/**
 * Creates a new sendbird user.
 * Please note that the profile_url and profile_file are required but should be set to an empty string.
 *
 * @returns {string} The user id.
 * @see https://sendbird.com/docs/chat/v3/platform-api/user/creating-users/create-a-user#2-responses
 */
export const createSendBirdUser = async (
  user_id: string,
  nickname: string,
  profile_url: string,
  profile_file: string
): Promise<string | null> => {
  // check if user exists
  const existingData = await findSendBirdUser(user_id)
  if (existingData && existingData.user_id) {
    console.log(
      `Returning existing user: ${existingData.user_id} - ${existingData.nickname}`
    )
    return existingData.user_id
  }

  // if not create user
  try {
    const data = await createSendBirdEntity<Member>("/v3/users", {
      user_id,
      nickname,
      profile_url,
      profile_file,
    })
    return data.user_id
  } catch (error) {
    Sentry.captureException(error)
    return null
  }
}

/**
 * Creates a sendbird channel for the given user.
 *
 * @param user_id
 * @returns The channel URL. A channel object and the full response object can be found here
 * @see https://sendbird.com/docs/chat/v3/platform-api/channel/creating-a-channel/create-a-group-channel#2-responses
 */
export const createSendBirdChannelForNewUser = async (
  user_id: string,
  nickname: string
) => {
  // check if channel exists
  const channels = await getSendBirdCollection<Channel>(
    "/v3/group_channels",
    "channels",
    { members_include_in: user_id }
  )

  if (channels && channels.length !== 0) {
    console.log(
      `Returned existing channel ${channels[0].channel_url} for user ${user_id}`
    )
    return channels[0].channel_url
  }

  // if channel doesnt exist create it
  try {
    const channel = await createSendBirdEntity<Channel>("/v3/group_channels", {
      name: `${nickname} - ${user_id}`,
      custom_type: "Alfie Chat",
      is_distinct: false,
      user_ids: [user_id],
    })

    console.log(`Created channel ${channel.channel_url} for user  ${user_id}`)
    return channel.channel_url
  } catch (error) {
    console.log(
      error,
      "error in createSendBirdChannelForNewUser when creating new channels"
    )
    Sentry.captureException(error)
  }
}

/** Deletes the given sendbird channel. */
export const deleteSendBirdChannel = async (channel_url: string) =>
  await deleteSendBirdEntity(`/v3/group_channels/${channel_url}`)

/**
 * Invites the given user to the given channel.
 *
 * @returns A channel object.
 * @see https://sendbird.com/docs/chat/v3/platform-api/channel/inviting-a-user/invite-as-members-channel#2-response
 */
export const inviteUserToChannel = async (
  channel_url: string,
  user_id: string,
  /** The user's provider. */
  provider: string
): Promise<Channel | null> => {
  const user_ids = [provider]

  if (process.env.NODE_ENV === "production") {
    // Gabrielle H is the first ID then Alex then rohit
    user_ids.push("63b85fa8ab80d27bb1af6d43")
    user_ids.push("639ba07cb937527a0c43484e")
    user_ids.push("639b9a70b937527a0c43484c")
  }

  const data = await createSendBirdEntity<Channel>(
    `/v3/group_channels/${channel_url}/invite`,
    { user_ids }
  )
  if (data) {
    console.log(`Invited user ${user_id} to channel ${data.channel_url}`)
    return data
  } else {
    console.log("error in inviteUserToChannel")
    return null
  }
}

/** Sends a message from the sendbird bot to the given channel. */
export const sendMessageToChannel = async (
  channel_url: string,
  message: string
): Promise<Message | null> => {
  const sendBirdBotId = "639ba07cb937527a0c43484e"

  const data = await createSendBirdEntity<Message>(
    `/v3/group_channels/${channel_url}/messages`,
    {
      message_type: "MESG",
      user_id: sendBirdBotId,
      message,
    },
    "error in sendMessageToChannel"
  )

  return data
}

/** Get all of a sendbird user's group channels. */
export const getSendBirdUserChannels = async (user_id: string) =>
  await getSendBirdCollection<Channel>(
    `/v3/users/${user_id}/my_group_channels`,
    "channels",
    { hidden_mode: "all" }
  )

/** Gets a list of all sendbird channels. */
export const listSendBirdChannels = async () =>
  await getPagedSendBirdCollection<Channel>(
    `/v3/group_channels`,
    "channels",
    { show_empty: true },
    "Error in listSendBirdChannels"
  )

/** Gets a list of all sendbird users. */
export const listSendBirdUsers = async () =>
  await getPagedSendBirdCollection<Member>(
    `/v3/users`,
    "users",
    { active_mode: "all" },
    "Error in listSendBirdUsers"
  )

/** Returns all users in the given sendbird group channel. */
export const getUsersInSendBirdChannel = async (channel_url: string) =>
  await getSendBirdCollection<Member>(
    `/v3/group_channels/${channel_url}/members`,
    "members",
    {},
    "error in getUsersInSendBirdChannel"
  )

/**
 * Creates all necessary sendbird objects for a new user.
 */
export const triggerEntireSendBirdFlow = async ({
  nickname,
  profile_file,
  profile_url,
  provider,
  user_id,
}: {
  user_id: string
  nickname: string
  profile_url: string
  profile_file: string
  provider: string
}): Promise<boolean> => {
  try {
    // Batch these in groups of 5 with an interval being every 10 seconds
    await createSendBirdUser(user_id, nickname, profile_url, profile_file)

    const channel_url = await createSendBirdChannelForNewUser(user_id, nickname)
    await inviteUserToChannel(channel_url, user_id, provider)
    if (process.env.NODE_ENV === "production") {
      await sendMessageToChannel(channel_url, "Welcome to Alfie Chat!")
    }

    return true
  } catch (error) {
    Sentry.captureException(error)
    console.log(
      `An error occured triggering the sendbird flow for user ID: ${user_id}`,
      error
    )
    return false
  }
}

/** Recreates the entire sendbird state, including users (patients and providers), and channels. */
export const findAndTriggerEntireSendBirdFlowForAllUsersAndProvider =
  async () => {
    try {
      console.log("Recreating sendbird state.")
      const channels = await listSendBirdChannels()
      console.log(`Deleting ${channels.length} sendbird channels.`)
      await batchAsync(
        channels.map(
          (channel) => async () =>
            await deleteSendBirdChannel(channel.channel_url)
        ),
        sendbirdBatchSize
      )

      const sendbirdUsers = await listSendBirdUsers()
      console.log(`Deleting ${sendbirdUsers.length} sendbird users.`)
      await batchAsync(
        sendbirdUsers.map(
          (user) => async () => await deleteSendBirdUser(user.user_id)
        ),
        sendbirdBatchSize
      )

      const providers = await ProviderModel.find()
      console.log(`Creating sendbird users for ${providers.length} providers.`)
      await batchAsync(
        providers.map(
          (provider) => async () =>
            await createSendBirdUser(
              provider._id,
              `${provider.firstName} ${provider.lastName}`,
              "",
              ""
            )
        ),
        sendbirdBatchSize
      )

      const users = await UserModel.find().populate<{ provider: Provider }>(
        "provider"
      )
      console.log(
        `Creating sendbird users and channels for ${users.length} users.`
      )
      await batchAsync(
        users.map((user) => async () => {
          if (user.provider?._id && user.role === Role.Patient) {
            await triggerEntireSendBirdFlow({
              nickname: user.name,
              profile_file: "",
              profile_url: "",
              provider: user.provider._id,
              user_id: user._id,
            })
          } else {
            await createSendBirdUser(user._id, user.name, "", "")
          }
          await new Promise((resolve) => setTimeout(resolve, 2000))
        }),
        sendbirdBatchSize
      )
      console.log(`All channels created and messages sent!`)
    } catch (e) {
      console.log(
        e,
        "Error in findAndTriggerEntireSendBirdFlowForAllUsersAndProvider"
      )
    }
  }

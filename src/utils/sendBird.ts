import * as Sentry from "@sentry/node"
import axios from "axios"
import config from "config"
import { Role, UserModel } from "../schema/user.schema"
import { Channel, Member, Message } from "./sendbirdtypes"
import { Provider, ProviderModel } from "../schema/provider.schema"
import batchAsync from "./batchAsync"
import { mapCollectionByField } from "./collections"

const sendbirdBatchSize = 5

const sendbirdAutoinviteUsers: string[] = []
if (process.env.SENDBIRD_AUTOINVITE_USERS) {
  const addUsers: string = process.env.SENDBIRD_AUTOINVITE_USERS
  sendbirdAutoinviteUsers.push(
    ...addUsers.split(",").map((user_id) => user_id.trim())
  )
} else if (process.env.NODE_ENV === "production") {
  // Gabrielle H is the first ID then Alex then rohit then Rachel
  sendbirdAutoinviteUsers.push(
    "63b85fa8ab80d27bb1af6d43",
    "639ba07cb937527a0c43484e",
    "639b9a70b937527a0c43484c",
    "63bd8d61af58147c29a7c272"
  )
}

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
      console.log(`${errorMessage}: ${error.message}`)
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
 * @returns The channel URL. A channel object and the full response object can be found here
 * @see https://sendbird.com/docs/chat/v3/platform-api/channel/creating-a-channel/create-a-group-channel#2-responses
 */
export const createSendBirdChannelForNewUser = async (
  user_id: string,
  nickname: string
): Promise<Channel | null> => {
  // check if there is a channel with the user as a member
  const channels = await getSendBirdUserChannels(user_id)

  if (channels && channels.length !== 0) {
    console.log(
      `Returned existing channel ${channels[0].channel_url} for user ${user_id}`
    )
    return channels[0]
  }

  // if channel doesnt exist create it
  try {
    const channel = await createSendBirdEntity<Channel>("/v3/group_channels", {
      name: `${nickname} - ${user_id}`,
      custom_type: "Alfie Chat",
      is_distinct: false,
      user_ids: [user_id],
    })

    console.log(`Created channel ${channel.channel_url} for user ${user_id}`)
    return channel
  } catch (error) {
    console.log(
      error,
      "error in createSendBirdChannelForNewUser when creating new channels"
    )
    Sentry.captureException(error)
    return null
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
  const channel = await getSendBirdChannel(channel_url)

  // only invite members not already in the channel
  const user_ids = [provider, ...sendbirdAutoinviteUsers].filter(
    (userId) => !channel.members?.some((member) => member.user_id === userId)
  )

  if (user_ids.length > 0) {
    // POST the invite (returns the modified channel object).
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
  } else {
    console.log(
      `All users already added to channel ${channel_url} (including ${user_id} and preset user IDs).`
    )
  }
}

/**
 * Returns messages in the given group channel.
 */
export const getMessagesInChannel = async (channel_url: string, limit = 10) => {
  const messages = await getSendBirdCollection<Message>(
    `/v3/group_channels/${channel_url}/messages`,
    "messages",
    {
      message_ts: Date.now(),
      prev_limit: limit,
      message_type: "MESG",
    },
    "error retrieving messages in channel"
  )
  return messages
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

/** Get a sendbird channel by url. */
export const getSendBirdChannel = async (channel_url: string) =>
  await getSendBirdEntity<Channel>(`/v3/group_channels/${channel_url}`, {
    show_member: true,
  })

/** Get all of a sendbird user's group channels. */
export const getSendBirdUserChannels = async (user_id: string) =>
  await getSendBirdCollection<Channel>("/v3/group_channels", "channels", {
    members_include_in: user_id,
    show_member: true,
  })

/** Gets a list of all sendbird channels. */
export const listSendBirdChannels = async (showMembers = false) =>
  await getPagedSendBirdCollection<Channel>(
    "/v3/group_channels",
    "channels",
    { show_empty: true, show_member: showMembers },
    "Error in listSendBirdChannels"
  )

/** Gets a list of all sendbird users. */
export const listSendBirdUsers = async () =>
  await getPagedSendBirdCollection<Member>(
    "/v3/users",
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
    // create the sendbird user
    await createSendBirdUser(user_id, nickname, profile_url, profile_file)

    // create a channel for the user, or return the existing channel
    const channel = await createSendBirdChannelForNewUser(user_id, nickname)

    // ensure that the provider and autoinvite users have been added to the channel
    await inviteUserToChannel(channel.channel_url, user_id, provider)

    // send a welcome message to the channel in production
    if (process.env.NODE_ENV === "production") {
      const messages = await getMessagesInChannel(channel.channel_url, 1)
      if (messages && messages.length === 0) {
        await sendMessageToChannel(
          channel.channel_url,
          "Welcome to Alfie Chat!"
        )
      }
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

      const users = await UserModel.find().populate<{ provider: Provider }>(
        "provider"
      )
      console.log("All users:")
      console.log(users.map((u) => `  * ${u._id} - ${u.name}`).join("\n"))

      const providers = await ProviderModel.find()
      const channels = await listSendBirdChannels(true)
      const sendbirdUsers = await listSendBirdUsers()

      // create maps by which to reference users and channels quickly by ID/url
      const sendbirdUsersMap = mapCollectionByField(
        sendbirdUsers,
        (item) => item.user_id
      )
      const usersMap = mapCollectionByField([...users, ...providers], (item) =>
        item._id.toString()
      )
      const providersMap = mapCollectionByField(providers, (item) =>
        item._id.toString()
      )

      // delete channels where none of the members correspond to database users.
      const channelsToDeleteNoDatabase: Channel[] = channels.filter(
        (channel) =>
          channel.members &&
          channel.members.every((user) => !usersMap[user.user_id])
      )

      // for each existing sendbird user, delete all but the first of their valid channels
      const channelsToDeleteDuplicates: Channel[] = []
      await batchAsync(
        users.map((user) => async () => {
          const userChannels = await getSendBirdUserChannels(
            user._id.toString()
          )
          const validChannels = userChannels.filter((channel) => {
            const hasProvider = channel.members.some(
              (member) => providersMap[member.user_id]
            )
            return hasProvider
          })
          // remove all channels except the first valid channel (or all channels if no channels are valid)
          const channelsToRemove =
            validChannels.length > 0
              ? userChannels.filter(
                  (uc) => uc.channel_url !== validChannels[0].channel_url
                )
              : userChannels
          channelsToDeleteDuplicates.push(...channelsToRemove)
        }),
        sendbirdBatchSize
      )

      // delete users who do not have a corresponding database ID.
      const usersToDelete: Member[] = sendbirdUsers.filter(
        (user) => !usersMap[user.user_id]
      )

      // insert providers who are not in sendbird yet
      const providersToCreate = providers.filter(
        (provider) => !sendbirdUsersMap[provider._id.toString()]
      )

      const deleteCategories: [Channel[], string][] = [
        [
          channelsToDeleteNoDatabase,
          "sendbird channels whose members are all invalid (not in the database)",
        ],
        [
          channelsToDeleteDuplicates,
          "sendbird channels which are duplicates for a given patient user",
        ],
      ]
      await Promise.all(
        deleteCategories.map(async ([channelsToDelete, deleteMessage]) => {
          if (channelsToDelete.length > 0) {
            console.log(`Deleting ${channelsToDelete.length} ${deleteMessage}`)
            console.log(
              channelsToDelete
                .map((channel) => {
                  const membersStr = channel.members
                    ? channel.members
                        .map((user) => `${user.user_id} - ${user.nickname}`)
                        .join(", ")
                    : "Unknown"
                  return `  * Channel - Members: ${membersStr} - ${channel.channel_url} - ${channel.custom_type}`
                })
                .join("\n")
            )
            await batchAsync(
              channelsToDelete.map(
                (channel) => async () =>
                  await deleteSendBirdChannel(channel.channel_url)
              ),
              sendbirdBatchSize
            )
          } else {
            console.log("All channels are valid, nothing to delete.")
          }
        })
      )

      if (usersToDelete.length > 0) {
        console.log(
          `Deleting ${usersToDelete.length} sendbird users without corresponding database users.`
        )
        console.log(
          usersToDelete
            .map(
              (user) =>
                `  * ${user.user_id} - ${user.nickname} - Active: ${user.is_active}`
            )
            .join("\n")
        )
        await batchAsync(
          usersToDelete.map(
            (user) => async () => await deleteSendBirdUser(user.user_id)
          ),
          sendbirdBatchSize
        )
      } else {
        console.log("All users are valid, nothing to delete.")
      }

      if (providersToCreate.length > 0) {
        console.log(
          `Creating the missing sendbird users for ${providersToCreate.length} providers.`
        )
        console.log(
          providersToCreate
            .map(
              (user) => `  * ${user._id} - ${user.firstName} ${user.lastName}`
            )
            .join("\n")
        )
        await batchAsync(
          providersToCreate.map((provider) => async () => {
            await createSendBirdUser(
              provider._id.toString(),
              `${provider.firstName} ${provider.lastName}`,
              "",
              ""
            )
            await new Promise((resolve) => setTimeout(resolve, 2000))
          }),
          sendbirdBatchSize
        )
      } else {
        console.log("All providers have sendbird users.")
      }

      console.log(
        `Creating or updating sendbird users and channels for all ${users.length} users.`
      )
      await batchAsync(
        users.map((user) => async () => {
          const userId = user._id.toString()
          if (user.provider?._id && user.role === Role.Patient) {
            // create user and channel for patients, invite their provider and preset user IDs
            await triggerEntireSendBirdFlow({
              nickname: user.name,
              profile_file: "",
              profile_url: "",
              provider: user.provider._id.toString(),
              user_id: userId,
            })
          } else {
            // just create the user for other types of users
            await createSendBirdUser(userId, user.name, "", "")
          }
          // 10 second delay between batches
          await new Promise((resolve) => setTimeout(resolve, 10000))
        }),
        sendbirdBatchSize
      )
      console.log("All channels created and messages sent!")
    } catch (e) {
      console.log(
        e,
        "Error in findAndTriggerEntireSendBirdFlowForAllUsersAndProvider"
      )
    }
  }

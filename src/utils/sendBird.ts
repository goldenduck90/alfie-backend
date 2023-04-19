import * as Sentry from "@sentry/node"
import axios from "axios"
import config from "config"
import { UserModel } from "./../schema/user.schema"

const sendBirdInstance = axios.create({
  baseURL: config.get("sendBirdApiUrl"),
  headers: {
    "Content-Type": "application/ json; charset = utf8",
    "Api-Token": process.env.SENDBIRD_API_TOKEN,
  },
})
// TODO: This whole file needs proper typing...

export const findSendBirdUser = async (user_id: string) => {
  try {
    const { data } = await sendBirdInstance.get(`/v3/users/${user_id}`)
    return data
  } catch (error) {
    Sentry.captureException(error)
  }
}

/**
 *
 * @param user_id
 * @param nickname
 * @param profile_url
 * @param profile_file
 * @returns a users data object and the full response object can be found here: https://sendbird.com/docs/chat/v3/platform-api/user/creating-users/create-a-user#2-responses
 *
 * Please note that the profile_url and profile_file are required but should be set to an empty string.
 */
const createSendBirdUser = async (
  user_id: string,
  nickname: string,
  profile_url: string,
  profile_file: string
) => {
  // check if user exists
  try {
    const { status, data: existingData } = await sendBirdInstance.get(
      `/v3/users/${user_id}`
    )
    if (status === 200 && existingData?.user_id) {
      return existingData.user_id
    }
  } catch (e) {
    console.log("No user found, moving on...")
  }

  // if not create user
  try {
    const { data } = await sendBirdInstance.post("/v3/users", {
      user_id,
      nickname,
      profile_url,
      profile_file,
    })
    return data.user_id
  } catch (error) {
    Sentry.captureException(error)
  }
}
/**
 *
 * @param user_id
 * @returns a channel object and the full response object can be found here: https://sendbird.com/docs/chat/v3/platform-api/channel/creating-a-channel/create-a-group-channel#2-responses
 */

const createSendBirdChannelForNewUser = async (
  user_id: string,
  nickname: string
) => {
  // check if channel exists
  try {
    const { data } = await sendBirdInstance.get(
      `/v3/group_channels?members_include_in=${user_id}`
    )

    if (data.channels.length !== 0) {
      return data.channels[0].channel_url
    } else {
      console.log("No channel found for user, moving on to create channel...")
    }
  } catch (e) {
    console.log(
      e,
      "error in createSendBirdChannelForNewUser when fetching existing channels"
    )
    Sentry.captureException(e)
  }

  // if channel doesnt exist create it
  try {
    const { data } = await sendBirdInstance.post("/v3/group_channels", {
      name: `${nickname} - ${user_id}`,
      custom_type: "Alfie Chat",
      is_distinct: false,
      user_ids: [user_id],
    })

    return data.channel_url
  } catch (error) {
    console.log(
      error,
      "error in createSendBirdChannelForNewUser when creating new channels"
    )
    Sentry.captureException(error)
  }
}

/**
 *
 * @param channel_url
 * @param message
 * @returns a message object and the full response object can be found here: https://sendbird.com/docs/chat/v3/platform-api/message/messaging-basics/send-a-message#2-responses
 */
const inviteUserToChannel = async (
  channel_url: string,
  user_id: string,
  provider: string
) => {
  const user_ids = [provider]

  if (process.env.NODE_ENV === "production") {
    // Gabrielle H is the first ID then Alex then rohit
    user_ids.push("63b85fa8ab80d27bb1af6d43")
    user_ids.push("639ba07cb937527a0c43484e")
    user_ids.push("639b9a70b937527a0c43484c")
  }

  try {
    const { data } = await sendBirdInstance.post(
      `/v3/group_channels/${channel_url}/invite`,
      {
        user_ids,
      }
    )

    console.log(
      `INVITED SENDBIRD CHANNEL FOR USER ID: ${user_id}: ${JSON.stringify(
        data
      )}`
    )

    return data
  } catch (error) {
    console.log(error, "error in inviteUserToChannel")
    Sentry.captureException(error)
  }
}
const sendMessageToChannel = async (channel_url: string, message: string) => {
  const sendBirdBotId = "639ba07cb937527a0c43484e"

  try {
    const { data } = await sendBirdInstance.post(
      `/v3/group_channels/${channel_url}/messages`,
      {
        message_type: "MESG",
        user_id: sendBirdBotId,
        message,
      }
    )
    return data
  } catch (error) {
    console.log(error, "error in sendMessageToChannel")
    Sentry.captureException(error)
  }
}

// get users by id and get their channel url
const getSendBirdUserChannelUrl = async (user_id: string) => {
  try {
    const response = await sendBirdInstance.get(
      `/v3/users/${user_id}/my_group_channels?hidden_mode=all`
    )
    console.log(response)
    return response.data.channels
  } catch (error) {
    console.log(error)
    Sentry.captureException(error)
  }
}

/**
 *
 * @param user_id
 * @param nickname
 * @param profile_url
 * @param profile_file
 * @returns TBD
 */
const triggerEntireSendBirdFlow = async ({
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
}) => {
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

const findAndTriggerEntireSendBirdFlowForAllUSersAndProvider = async () => {
  try {
    // const providers: any = await ProviderModel.find()
    const allUsersAndProvider: any = await UserModel.find().populate("provider")
    // console.log(allUsersAndProvider, "allUsersAndProvider")
    for (let i = 0; i < allUsersAndProvider.length; i += 5) {
      const batch = allUsersAndProvider.slice(i, i + 5)
      console.log(batch.length, "batch length")
      console.log(batch[0]?.name, "batch[0].name")

      await Promise.all(
        batch.map(async (user: any) => {
          if (user?.provider?._id) {
            await triggerEntireSendBirdFlow({
              nickname: user?.name,
              profile_file: "",
              profile_url: "",
              provider: user?.provider?._id,
              user_id: user?._id,
            })
          }
        })
      )
      await new Promise((resolve) => setTimeout(resolve, 10000))
    }
    return "All channels created and messages sent!"
  } catch (e) {
    console.log(e, "Error")
  }
}

export {
  sendBirdInstance,
  createSendBirdUser,
  createSendBirdChannelForNewUser,
  inviteUserToChannel,
  getSendBirdUserChannelUrl,
  triggerEntireSendBirdFlow,
  findAndTriggerEntireSendBirdFlowForAllUSersAndProvider,
}

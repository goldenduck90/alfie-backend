import * as Sentry from "@sentry/node"
import axios from "axios"

const sendBirdInstance = axios.create({
  baseURL: process.env.SEND_BIRD_API_URL,
  headers: {
    "Content-Type": "application/ json; charset = utf8",
    "Api-Token": process.env.SENDBIRD_API_TOKEN,
  },
})
// TODO: This whole file needs proper typing...

const findSendBirdUser = async (user_id: string) => {
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
  try {
    const { data } = await sendBirdInstance.post("/v3/users", {
      user_id,
      nickname,
      profile_url,
      profile_file,
    })
    return data
  } catch (error) {
    Sentry.captureException(error)
  }
}
/**
 *
 * @param user_id
 * @returns a channel object and the full response object can be found here: https://sendbird.com/docs/chat/v3/platform-api/channel/creating-a-channel/create-a-group-channel#2-responses
 */

const createSendBirdChannelForNewUser = async (user_id: string) => {
  try {
    return await sendBirdInstance.post("/v3/group_channels", {
      name: "Alfie Chat",
      custom_type: "Alfie Chat",
      is_distinct: false,
      user_ids: [user_id],
    })
  } catch (error) {
    // console.log(error, "error in createSendBirdChannelForNewUser")
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
  try {
    const { data } = await sendBirdInstance.post(
      `/v3/group_channels/${channel_url}/invite`,
      {
        user_ids: [user_id, provider, "639b9a70b937527a0c43484c", "639ba055b937527a0c43484d", "639ba07cb937527a0c43484e"],
      }
    )
    return data
  } catch (error) {
    Sentry.captureException(error)
  }
}
const sendMessageToChannel = async (channel_url: string, message: string) => {
  try {
    const { data } = await sendBirdInstance.post(
      `/v3/group_channels/${channel_url}/messages`,
      {
        message_type: "MESG",
        user_id: "639ba07cb937527a0c43484e",
        message,
      }
    )
    return data
  } catch (error) {
    console.log(error, "error in sendMessageToChannel")
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
  providerName,
}: {
  user_id: string
  nickname: string
  profile_url: string
  profile_file: string
  provider: string
  providerName: string
}) => {
  try {
    const currentSendBirdProvider = await findSendBirdUser(provider)
    if (!currentSendBirdProvider) {
      await createSendBirdUser(provider, providerName, "", "")
    }
    await createSendBirdUser(
      user_id,
      nickname,
      profile_url,
      profile_file
    )
    const channel = await createSendBirdChannelForNewUser(user_id)
    await inviteUserToChannel(channel.data.channel_url, user_id, provider)

    await sendMessageToChannel(channel.data.channel_url, "Welcome to Alfie Chat!")

    return "Channels created and messages sent!"
  } catch (error) {
    Sentry.captureException(error)
    throw new Error(error)
  }
}
export {
  sendBirdInstance,
  createSendBirdUser,
  createSendBirdChannelForNewUser,
  inviteUserToChannel,
  triggerEntireSendBirdFlow,
}

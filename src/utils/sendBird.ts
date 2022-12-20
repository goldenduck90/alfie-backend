import * as Sentry from "@sentry/node"
import axios from "axios"

const channelMessages = [
  {
    type: "Health Coach",
    message:
      "Use this channel to speak with your health coach. You'll be assigned a health coach after meeting with the provider and receiving your prescription.",
  },
  {
    type: "Medical",
    message:
      "Use this channel to message directly with your provider and the medical team regarding medications or other questions. You'll see a task to schedule with a provider once we have received your lab results. ",
  },
  {
    type: "Customer Support",
    message:
      "Use this channel to speak with a customer support representative. If you need help getting medication approval, working with the pharmacy, or other questions.",
  },
]
const sendBirdInstance = axios.create({
  baseURL: process.env.SEND_BIRD_API_URL,
  headers: {
    "Content-Type": "application/ json; charset = utf8",
    "Api-Token": process.env.SENDBIRD_API_TOKEN,
  },
})
// TODO: This whole file needs proper typing...

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
    console.log(error, "error in createSendBirdUser")
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
    console.log(error, "error in createSendBirdChannelForNewUser")
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
        user_ids: [user_id, 1, provider], // User id 1 is the admin
      }
    )
    return data
  } catch (error) {
    console.log(error, "error in inviteUserToChannel")
    Sentry.captureException(error)
  }
}
const sendMessageToChannel = async (channel_url: string, message: string) => {
  try {
    const { data } = await sendBirdInstance.post(
      `/v3/group_channels/${channel_url}/messages`,
      {
        message_type: "MESG",
        user_id: "1",
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
}: {
  user_id: string
  nickname: string
  profile_url: string
  profile_file: string
  provider: string
}) => {
  try {
    const user = await createSendBirdUser(
      user_id,
      nickname,
      profile_url,
      profile_file
    )
    console.log(user, "user")
    const channel = await createSendBirdChannelForNewUser(user.user_id)
    console.log(channel, "channel")
    await inviteUserToChannel(channel.data.channel_url, user.user_id, provider)

    const message = channelMessages.find(
      (channelMessage) => channelMessage.type === channel.data.name
    )
    await sendMessageToChannel(channel.data.channel_url, message.message)

    return "Channels created and messages sent!"
  } catch (error) {
    console.log(error, "error in triggerEntireSendBirdFlow")
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

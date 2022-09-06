import axios from "axios"
const channelMessages = [
  {
    type: "Health Coach",
    message: "Welcome to the Health Coach channel!",
  },
  {
    type: "Medical",
    message: "Welcome to the Medical channel!",
  },
  {
    type: "Customer Support",
    message: "Welcome to the Customer Support channel!",
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
    throw new Error(error)
  }
}
/**
 *
 * @param user_id
 * @returns a channel object and the full response object can be found here: https://sendbird.com/docs/chat/v3/platform-api/channel/creating-a-channel/create-a-group-channel#2-responses
 */

const createSendBirdChannelForNewUser = async (user_id: string) => {
  try {
    const healthCoach = await sendBirdInstance.post("/v3/group_channels", {
      name: "Health Coach",
      custom_type: "Health Coach",
      is_distinct: false,
      user_ids: [user_id],
    })
    const medical = await sendBirdInstance.post("/v3/group_channels", {
      name: "Medical",
      custom_type: "Medical",
      is_distinct: false,
      user_ids: [user_id],
    })
    const customerSupport = await sendBirdInstance.post("/v3/group_channels", {
      name: "Customer Support",
      custom_type: "Customer Support",
      is_distinct: false,
      user_ids: [user_id],
    })
    const channels = Promise.all([healthCoach, medical, customerSupport])
    return channels
  } catch (error) {
    throw new Error(error)
  }
}
/**
 *
 * @param channel_url
 * @param message
 * @returns a message object and the full response object can be found here: https://sendbird.com/docs/chat/v3/platform-api/message/messaging-basics/send-a-message#2-responses
 */
const inviteUserToChannel = async (channel_url: string, user_id: string) => {
  try {
    const { data } = await sendBirdInstance.post(
      `/v3/group_channels/${channel_url}/invite`,
      {
        user_ids: [user_id, 1], // iser id 1 is the admin
      }
    )
    return data
  } catch (error) {
    throw new Error(error)
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
    throw new Error(error)
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
const triggerEntireSendBirdFlow = async (
  user_id: string,
  nickname: string,
  profile_url: string,
  profile_file: string
) => {
  try {
    const user = await createSendBirdUser(
      user_id,
      nickname,
      profile_url,
      profile_file
    )
    const channels = await createSendBirdChannelForNewUser(user.user_id)
    await Promise.all(
      channels.map((channel) => {
        return inviteUserToChannel(channel.data.channel_url, user.user_id)
      })
    )
    await Promise.all(
      channels.map((channel) => {
        const message = channelMessages.find(
          (channelMessage) => channelMessage.type === channel.data.name
        )
        return sendMessageToChannel(channel.data.channel_url, message.message)
      })
    )
    return "Channels created and messages sent!"
  } catch (error) {
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

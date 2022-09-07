import axios from "axios"
import { UserModel } from "../schema/user.schema"

const dailyInstance = axios.create({
  baseURL: process.env.SEND_BIRD_API_URL,
  headers: {
    Authorization: `Bearer ${process.env.DAILY_API_KEY}`,
  },
})

const createDailyRoom = async () => {
  try {
    const data = await dailyInstance.post("/rooms", {
      privacy: "true",
      properties: {
        enable_knocking: true,
        exp: 1630000000, // TODO: Enable expiration date to be 4hrs after the meeting starts
      },
    })
    return data
  } catch (error) {
    throw new Error(error)
  }
}
/**
 *
 * @param roomName
 * @returns
 */
const createDailyMeetingToken = async (roomName: string) => {
  try {
    const data = await dailyInstance.post("/meeting-tokens", {
      room_name: roomName,
      // exp: TODO: Enable expiration date to be 4hrs after the meeting starts
    })
    return data
  } catch (error) {
    throw new Error(error)
  }
}
/**
 *
 * @param user_id
 * @returns
 */
const createMeetingAndToken = async (user_id: string) => {
  try {
    const room = await createDailyRoom()
    const token = await createDailyMeetingToken(room.data.room_name)
    await UserModel.updateOne(
      { _id: user_id },
      { meetingRooomUrl: `${room.data.url}?t=${token.data.token}` }
    )
    return { room: room.data, token: token.data }
  } catch (error) {
    throw new Error(error)
  }
}
export { createDailyRoom, createDailyMeetingToken, createMeetingAndToken }

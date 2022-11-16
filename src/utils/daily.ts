import axios from "axios"
import { UserModel } from "../schema/user.schema"
import config from "config"
import * as Sentry from "@sentry/node"
const dailyInstance = axios.create({
  baseURL: process.env.DAILY_API_URL,
  headers: {
    Authorization: `Bearer ${process.env.DAILY_API_KEY}`,
  },
})

const createDailyRoom = async () => {
  try {
    const data = await dailyInstance.post("/rooms", {
      privacy: "public",
      properties: {
        enable_knocking: true,
        // TODO: Enable expiration date to be 4hrs after the meeting starts
        // exp: 1630000000,
      },
    })
    return data
  } catch (error) {
    Sentry.captureException(error)
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
      properties: {
        room_name: roomName,
      },
      // exp: TODO: Enable expiration date to be 4hrs after the meeting starts
    })
    return data
  } catch (error) {
    Sentry.captureException(error)
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
    await createDailyMeetingToken(room.data.name)
    const meetingRoomUrl = `${config.get("baseUrl")}/appointments/call/${
      room.data.name
    }`
    await UserModel.updateOne(
      { _id: user_id },
      { meetingRoomUrl: meetingRoomUrl }
    )
    return meetingRoomUrl
  } catch (error) {
    Sentry.captureException(error)
    throw new Error(error)
  }
}
export { createDailyRoom, createDailyMeetingToken, createMeetingAndToken }

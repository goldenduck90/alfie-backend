import runShell, { createProgram } from "./utils/runShell"
import AppointmentService from "../src/services/appointment.service"
import UserService from "../src/services/user.service"

const options = createProgram()
  .description("Retrieves timeslots for the given user.")
  .requiredOption("--user <userId>", "The user ID.")
  .requiredOption("--day <calendarDate>", "YYYY-MM-DD format day to retrieve.")
  .option("--timezone <timezone>", "The timezone.", "America/New_York")
  .parse()
  .opts<{ user: string; day: string; timezone: string }>()

async function testTimeslots() {
  const input = {
    bypassNotice: true,
    healthCoach: false,
    selectedDate: options.day,
    timezone: options.timezone,
  }

  const appointmentService = new AppointmentService()
  const userService = new UserService()

  const user = await userService.getUser(options.user)

  console.log(
    `Querying timeslots for user ${user._id} and input ${JSON.stringify(input)}`
  )

  const timeslots = await appointmentService.getTimeslots(user, input)
  console.log(`Result: ${JSON.stringify(timeslots, null, "  ")}`)
}

runShell(() => testTimeslots())

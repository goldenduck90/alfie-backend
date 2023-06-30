import runShell, { createProgram } from "./utils/runShell"
import mockEmails from "./utils/mockEmails"
import dayjs from "../src/utils/dayjs"
import AppointmentService from "../src/services/appointment.service"
import UserService from "../src/services/user.service"
import TaskService from "../src/services/task.service"
import { TaskType } from "../src/schema/task.schema"
import { ProviderModel } from "../src/schema/provider.schema"

const program = createProgram()
  .description("Tests the post-appointment job.")
  .option(
    "--user <userId>",
    "The user ID to use as the test user.",
    "6492287cb8fcaec82d342955"
  )
  .parse()

const { user: userId } = program.opts<{ user: string }>()

async function testPostAppointmentJob() {
  mockEmails()

  const appointmentService = new AppointmentService()
  const userService = new UserService()
  const taskService = new TaskService()
  const dateTimeFormat = "YYYY-MM-DD HH:mm:ss"

  const user = await userService.getUser(userId)
  user.eaHealthCoachId = "22"

  const provider = await ProviderModel.findOne({ eaProviderId: "2" })
  user.provider = provider._id
  await user.save()

  const timezone = "America/New_York"
  const appointmentDate = dayjs()
    .tz(timezone)
    .hour(Math.floor(Math.random() * 24))
    .minute(Math.floor(Math.random() * 50))
    .second(0)
    .millisecond(0)

  const createTask = async (type: TaskType) => {
    let userTask = await taskService.assignTaskToUser({
      taskType: type,
      userId: user._id.toString(),
    })
    userTask = await taskService.completeUserTask({
      _id: userTask._id.toString(),
      answers: [],
    })
    return userTask
  }

  const userTask = await createTask(TaskType.SCHEDULE_APPOINTMENT)
  const futureTask = await createTask(TaskType.SCHEDULE_APPOINTMENT)

  // create a few appointments and mark attended
  try {
    // past appointment (should be processed).
    const appointments = await Promise.all(
      [30, 90].map(async (addMinutes) => {
        return await appointmentService.createAppointment(user, {
          bypassNotice: true,
          start: appointmentDate
            .add(-1, "days")
            .add(addMinutes, "minutes")
            .format(dateTimeFormat),
          end: appointmentDate
            .add(-1, "days")
            .add(addMinutes + 5, "minutes")
            .format(dateTimeFormat),
          timezone,
          notes: "testPostAppointmentsJob",
          userId: user._id.toString(),
          userTaskId: userTask._id.toString(),
        })
      })
    )

    // set one of the appointments as attended.
    await appointmentService.updateAppointmentAttended(
      user,
      appointments[0].eaAppointmentId,
      ["provider_attended", "patient_attended"]
    )

    // future appointment (not processed).
    await appointmentService.createAppointment(user, {
      bypassNotice: true,
      start: appointmentDate.add(1, "days").format(dateTimeFormat),
      end: appointmentDate
        .add(1, "days")
        .add(5, "minutes")
        .format(dateTimeFormat),
      timezone,
      notes: "testPostAppointmentsJob",
      userId: user._id.toString(),
      userTaskId: futureTask._id.toString(),
    })
  } catch (error) {
    console.log(`Error creating appointments: ${error}`)
  } finally {
    await appointmentService.postAppointmentJob()
  }
}

runShell(() => testPostAppointmentJob())

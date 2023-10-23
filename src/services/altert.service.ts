import { User } from "../schema/user.schema"
import { Task, TaskType } from "../schema/task.schema"
import { UserTask } from "../schema/task.user.schema"
import { AlertModel, SeverityType } from "../schema/alert.schema"
import { UserModel } from "../schema/user.schema"
import Role from "../schema/enums/Role"
import { UserTaskModel } from "../schema/task.user.schema"
import { TaskModel } from "../schema/task.schema"
import EmailService from "./email.service"
import { Provider, ProviderModel } from "../schema/provider.schema"

export default class AlertService {
  private emailService: EmailService

  constructor() {
    this.emailService = new EmailService()
  }

  async createAlert(alert: {
    title: string
    description: string
    task: Task
    user: User
    provider: Provider
    severity: SeverityType
    medical: boolean
  }) {
    if (
      [SeverityType.EXTREME, SeverityType.HIGH].includes(alert.severity) &&
      alert.medical
    ) {
      // Send alert email
      const subject = `ATTN: Alert for ${alert.user.name}`
      const body = `
      Hi,
      <br />
      This is an alert from Alfie about your patient ${alert.user.name}.
      <br />
      There is something in their profile that requires your clinical attention. Please take a look at your earliest convenience.
      <br />
      <br />
      Thanks,
      <br />
      Alfie Alerts
      `
      const doctors = await ProviderModel.find({ type: Role.Doctor })

      const licensedDoctors = doctors.filter((doctor: Provider) =>
        doctor.licensedStates.includes(alert.user.address.state)
      )

      const provider = await ProviderModel.findById(alert.provider)

      const toEmails = [
        "billy@joinalfie.com",
        "patients@joinalfie.com",
        "chelsea@joinalfie.com",
        provider.email,
        ...licensedDoctors.map((doctor: Provider) => doctor.email),
      ]

      await this.emailService.sendEmail(subject, body, toEmails)
    }

    await AlertModel.create(alert)
  }

  async checkUserTaskCompletion(user: User, task: Task, userTask: UserTask) {
    switch (task.type) {
      case TaskType.BP_LOG: {
        // BP goes above 140/90
        const systolicBp = userTask.answers.find(
          (answer) => answer.key === "systolicBp"
        )

        const diastolicBp = userTask.answers.find(
          (answer) => answer.key === "diastolicBp"
        )
        if (
          (systolicBp.value as number) >= 140 ||
          (diastolicBp.value as number) >= 90
        ) {
          await this.createAlert({
            title: "Hypertension Alert",
            description: "The patients blood pressure requires attention",
            task: task,
            user: user,
            provider: user.provider as Provider,
            severity: SeverityType.HIGH,
            medical: true,
          })
        }
        break
      }
      case TaskType.MP_HUNGER:
      case TaskType.MP_ACTIVITY:
      case TaskType.MP_FEELING: {
        // If any calculated score changes by +/- 20% within a month
        const dt = new Date()
        dt.setMonth(dt.getMonth() - 1)

        const scoresWithin30Days = user.score
          .filter(
            (score) =>
              score.date >= dt && score.task === task.type && score.percentile
          )
          .sort((a, b) => (a.date > b.date ? -1 : 1))

        if (scoresWithin30Days.length > 1) {
          const lastScore = scoresWithin30Days.pop().percentile

          const minScore = scoresWithin30Days.reduce(
            (a, b) => (a < b.percentile ? a : b.percentile),
            0
          )

          const maxScore = scoresWithin30Days.reduce(
            (a, b) => (a < b.percentile ? a : b.percentile),
            0
          )

          const minScoreChange =
            (Math.abs(lastScore - minScore) / lastScore) * 100
          const maxScoreChange =
            (Math.abs(lastScore - maxScore) / lastScore) * 100
          if (minScoreChange >= 20 || maxScoreChange >= 20) {
            await this.createAlert({
              title: "Large Metabolic Profile Shift",
              description:
                "The patient has had a large shift in their MP and may need new medications",
              task: task,
              user: user,
              provider: user.provider as Provider,
              severity: SeverityType.LOW,
              medical: true,
            })
          }
        }

        break
      }
      case TaskType.WEIGHT_LOG: {
        // Weight changes by >10% in one week
        const dt = new Date()
        dt.setDate(dt.getDate() - 7)

        const weightsWithin7Days = user.weights
          .filter((weight) => weight.date >= dt && weight.value)
          .sort((a, b) => (a.date > b.date ? -1 : 1))

        if (weightsWithin7Days.length > 1) {
          const lastWeight = weightsWithin7Days.pop().value

          const minWeight = weightsWithin7Days.reduce(
            (a, b) => (a < b.value ? a : b.value),
            0
          )

          const maxWeight = weightsWithin7Days.reduce(
            (a, b) => (a < b.value ? a : b.value),
            0
          )

          const minWeightChange =
            (Math.abs(lastWeight - minWeight) / lastWeight) * 100
          const maxWeightChange =
            (Math.abs(lastWeight - maxWeight) / lastWeight) * 100
          if (minWeightChange >= 10 || maxWeightChange >= 10) {
            await this.createAlert({
              title: "Abnormal Weight Loss",
              description: "The patient has lost too much weight too quickly",
              task: task,
              user: user,
              provider: user.provider as Provider,
              severity: SeverityType.HIGH,
              medical: true,
            })
          }
        }

        break
      }
      default:
        break
    }
  }

  async alertJob() {
    // NO_RPM: Patient has no recorded weight on smart scale
    // TODO: check if not logging weight prevents RPM
    const patients = await UserModel.find({
      role: Role.Patient,
      hasScale: true,
    })

    const startOfThisWeek = new Date()
    startOfThisWeek.setDate(startOfThisWeek.getDate() - new Date().getDay())

    const task = await TaskModel.find().findByType(TaskType.WEIGHT_LOG)

    for (const patient of patients) {
      const completedTasksWithinAWeek = await UserTaskModel.find({
        task,
        user: patient,
        completed: true,
        completedAt: { $gte: startOfThisWeek },
      })

      if (completedTasksWithinAWeek.length === 0) {
        // Add alert
        await this.createAlert({
          title: "Patient has not been weighing themselves on scale",
          description:
            "Patient has not weighed themselves this week, and prevents RPM. May need to message patient on inform care coordination",
          task: task,
          user: patient,
          provider: patient.provider as Provider,
          severity: SeverityType.LOW,
          medical: false,
        })
      }
    }

    // NO_MP: Patient has no MP for previous month
    // TODO: TBD
  }

  async getAlertsByPatient(provider: User, patientId?: string) {
    let query
    if (patientId) {
      query = {
        provider: provider._id,
        user: patientId,
      }
    } else {
      query = {
        provider: provider._id,
      }
    }
    const alerts = await AlertModel.find({ ...query })
      .populate("user")
      .populate("task")
      .sort({ createdAt: -1 })
    return alerts
  }

  async acknowledgeAlert(alertId: string) {
    const alert = await AlertModel.findById(alertId)
    alert.acknowledgedAt = new Date()
    await alert.save()

    return alert
  }
}

import { User } from "../schema/user.schema"
import { Task, TaskType } from "../schema/task.schema"
import { UserTask } from "../schema/task.user.schema"
import { AlertModel, SeverityType } from "../schema/alert.schema"

export default class AlertService {
  async checkUserTaskCompletion(user: User, task: Task, userTask: UserTask) {
    switch (task.type) {
      case TaskType.BP_LOG: {
        const systolicBp = userTask.answers.find(
          (answer) => answer.key === "systolicBp"
        )

        const diastolicBp = userTask.answers.find(
          (answer) => answer.key === "diastolicBp"
        )
        if (
          (systolicBp.value as number) >= 140 &&
          (diastolicBp.value as number) >= 90
        ) {
          await AlertModel.create({
            title: "Hypertension Alert",
            description: "The patients blood pressure requires attention",
            task: task,
            user: user,
            severity: SeverityType.HIGH,
            medical: true,
          })
        }
        break
      }
      case TaskType.WEIGHT_LOG:
        break
      default:
        break
    }
  }
}

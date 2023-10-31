import { ApolloError } from "apollo-server"
import { NPSModel, NPSInput } from "../schema/NPS.schema"
import { User } from "../schema/user.schema"
import EmailService from "./email.service"

class NPSService extends EmailService {
  async createSurvey(user: User, appointmentId: string) {
    const nps = await NPSModel.create({
      user,
      appointmentId,
    })

    const subject = "We’d love to hear about your recent appointment"
    const hostname =
      process.env.NODE_ENV === "development"
        ? "https://develop.joinalfie.com"
        : "https://app.joinalfie.com"

    const surveyUrl = `${hostname}/survey/${nps._id}`

    const body = `
    Dear ${user.name}, <br><br>

    We hope you're doing well. At Alfie Health, your well-being and satisfaction are of utmost importance to us. We're continuously striving to enhance our services and would love to hear about your recent visit.<br>

    By sharing your thoughts, you play an essential role in helping us serve you better. Please take a moment to complete our brief survey by clicking the link below:<br>

    Take the Survey <a href="${surveyUrl}" target="_blank">${surveyUrl}</a><br>

    Your feedback is confidential, and the survey should take no more than a couple of minutes of your time.<br>

    Thank you for choosing Alfie Health. We look forward to serving you again soon.<br><br>

    Warm regards,<br>

    The Alfie Health Team
    `
    await this.sendEmail(subject, body, [user.email])
  }

  async getSurvey(id: string) {
    return await NPSModel.findById(id)
  }

  async submitSurvey(input: NPSInput) {
    try {
      const nps = await NPSModel.findById(input.id)

      nps.score = input.score
      nps.textAnswer = input.textAnswer
      nps.feedback = input.feedback
      await nps.save()
    } catch (err) {
      throw new ApolloError(err.message, "ERROR")
    }
  }
}

export default NPSService

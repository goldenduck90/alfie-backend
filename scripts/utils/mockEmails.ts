import EmailService from "../../src/services/email.service"

export default function mockEmails() {
  EmailService.prototype.sendEmail = async (...args: any[]) => {
    console.log(`sendEmail call: ${JSON.stringify(args)}`)
    return { MessageId: "123", $response: {} as any }
  }
}

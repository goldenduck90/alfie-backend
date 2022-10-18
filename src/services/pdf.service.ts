import { promises } from "fs"
import { PDFDocument, rgb, StandardFonts } from "pdf-lib"
import fontkit from "@pdf-lib/fontkit"
import { format } from "date-fns"

class PDFService {
  async getLabOrderTemplate(): Promise<ArrayBufferLike> {
    const file = await promises.readFile("./assets/lab-order-template.pdf")
    return file.buffer
  }

  async createLabOrderPdf({
    providerFullName,
    providerNpi,
    patientFullName,
    patientDob,
    icdCode,
  }: {
    providerFullName: string
    providerNpi: string
    patientFullName: string
    patientDob: Date
    icdCode: string
  }) {
    const template = await this.getLabOrderTemplate()

    const pdfDoc = await PDFDocument.load(template)
    const tnr = await pdfDoc.embedFont(StandardFonts.TimesRoman)
    const agfBuffer = await (
      await promises.readFile("./assets/Autography-DOLnW.otf")
    ).buffer
    pdfDoc.registerFontkit(fontkit)
    const agf = await pdfDoc.embedFont(agfBuffer)

    const page = pdfDoc.getPage(0)
    const fontSize = 12
    const sigFontSize = 24

    page.drawText(providerFullName, {
      x: 103.25,
      y: 540,
      size: fontSize,
      font: tnr,
      color: rgb(0, 0, 0),
    })

    page.drawText(providerNpi, {
      x: 94.5,
      y: 510,
      size: fontSize,
      font: tnr,
      color: rgb(0, 0, 0),
    })

    page.drawText(patientFullName, {
      x: 60.75,
      y: 478,
      size: fontSize,
      font: tnr,
      color: rgb(0, 0, 0),
    })

    page.drawText(format(patientDob, "MM/dd/yyyy"), {
      x: 53.25,
      y: 446.125,
      size: fontSize,
      font: tnr,
      color: rgb(0, 0, 0),
    })

    page.drawText(icdCode, {
      x: 327.75,
      y: 374,
      size: fontSize,
      font: tnr,
      color: rgb(0, 0, 0),
    })

    page.drawText(providerFullName, {
      x: 73.5,
      y: 300,
      size: sigFontSize,
      font: agf,
      color: rgb(0, 0, 0),
    })

    const pdfBytes = await pdfDoc.save()
    return pdfBytes
  }
}

export default PDFService

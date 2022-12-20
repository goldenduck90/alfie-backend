import axios from "axios"
import csv from "csv-writer"
import fs from "fs"
const instance = axios.create({
  baseURL: "https://api.akutehealth.com/v1",
  headers: {
    "Content-Type": "application/json",
    "X-API-KEY":
      "AQICAHhkrMEWLGV5I/np1unkQq0g8FND1rTDMACXtGdiXD8PWwEbevf2QazRBT77NExozLQrAAAAjzCBjAYJKoZIhvcNAQcGoH8wfQIBADB4BgkqhkiG9w0BBwEwHgYJYIZIAWUDBAEuMBEEDOKeqNdyE7rPlre14gIBEIBLhbPBozENXpVhzhiCYqyXGdbQFJaTYjsbvTASOeRlJqDzNWl6H/Uvas0WHeZfOVUe/FFaG/5GgxtCGAryapyfG8DhH9BqvZ7TZjDB",
  },
})

async function getPatientMedications() {
  try {
    // get all patients from akute by calling /patients?status=active
    // get all medications for each patient by calling /medications?patient_id=patient_id
    // Only show patients with medications where the generic_name = "tirzepatide"

    const { data: patients } = await instance.get("/patients?status=active")
    const patientMedications = await Promise.all(
      patients.map(async (patient) => {
        const response = await instance.get(
          `/medications?patient_id=${patient.id}`
        )
        if (response.data.length === 0) return null
        return {
          patient,
          medications: response.data.filter(
            (medication) => medication.generic_name === "tirzepatide"
          ),
        }
      })
    )
    console.log(patientMedications, "patientMedications")
    // pipe patient records into a csv file
    const csvData = patientMedications
      .filter((patient) => patient !== null)
      .map((patient) => {
        return {
          patient_id: patient.patient.id,
          patient_name:
            patient.patient.first_name + " " + patient.patient.last_name,
        }
      })
    const csvWriter = csv.createObjectCsvWriter({
      path: "patients.csv",
      header: [
        { id: "patient_id", title: "Patient ID" },
        { id: "patient_name", title: "Patient Name" },
      ],
    })
    await csvWriter.writeRecords(csvData)
    console.log("CSV file successfully written")
  } catch (e) {
    console.log(e)
  }
}

getPatientMedications()

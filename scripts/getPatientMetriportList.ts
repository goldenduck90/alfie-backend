import { connectToMongo } from "../src/utils/mongo"
import { Gender, UserModel } from "../src/schema/user.schema"
import { createObjectCsvWriter } from "csv-writer"
import { format } from "date-fns"

async function getPatientMetriportList() {
  try {
    const data: any[] = []

    const users = await UserModel.find({
      _id: [
        "63a5ff67ec5d0f9a4f55bed6",
        "64015a8c425af4b4fa6ac51e",
        "63a5ff69ec5d0f9a4f55bf18",
        "63a5ff4fec5d0f9a4f55bc42",
        "63a5ff6bec5d0f9a4f55bf5a",
        "63a600a3a82aa797c06c9087",
        "63a600a7a82aa797c06c90ea",
        "63a60053a82aa797c06c87e4",
        "63a5fdbc903126300bcb6ea1",
        "63a5ff64ec5d0f9a4f55be94",
        "63a6003aa82aa797c06c8592",
        "63a5fdb2903126300bcb6d99",
        "63a60097a82aa797c06c8f3d",
        "63a6004ea82aa797c06c8760",
        "63aee0679c688e295502b35b",
        "63a5fdf8903126300bcb74d1",
        "63a5fce3d5398394ab188c9e",
        "6512fbddc7333532fa6f0337",
        "637d097b2aeea5829f8ec82f",
        "63a5fdd1903126300bcb70f3",
        "64693db809a0b40bb22c06b9",
        "6491d9fba9ebf405d12edfa9",
        "63a5fdf1903126300bcb740b",
        "63a60048a82aa797c06c86bb",
        "63a5ff55ec5d0f9a4f55bce7",
        "64b5dc74b7345cf18d118182",
        "6465860c9857f5025b8bfd2f",
        "648c7fa5a9ebf405d12ed8f4",
        "63a5ff7cec5d0f9a4f55c128",
        "6463db9c9857f5025b8bf8e5",
        "63a5fdb0903126300bcb6d57",
        "6501cec9263714e33b05303b",
        "63e64a42d7917d618ea1a8e8",
        "63a5fdd0903126300bcb70d2",
        "648c056ca9ebf405d12ed84a",
        "63a5fdf9903126300bcb74f2",
        "63659271cb2af81b812ae96b",
        "64a31d2367d1fb57498433ee",
        "63a5fdaa903126300bcb6cd3",
        "64faf6d2fd337d4c811dbbac",
        "64ff1a64fd337d4c811dc9c9",
        "64e8f3f5809cc0ad91ea985a",
        "64eba6c2809cc0ad91ea9ce4",
        "64d9bb956959a559ea9ef7d9",
        "649cf31c67d1fb57498423b2",
        "649d84d767d1fb5749842546",
        "649da2a967d1fb5749842673",
        "649f08e367d1fb5749842c92",
        "64ac565d67d1fb5749844808",
        "64b0ca7bb7345cf18d117949",
        "63a5fce1d5398394ab188c5c",
        "63a5fd92903126300bcb69dc",
        "64963d802c9b95d451c79d42",
        "63a5fdf0903126300bcb73ea",
        "63a6006aa82aa797c06c8a78",
        "63a5fda9903126300bcb6cb2",
        "63fe65f4425af4b4fa22d065",
        "63a5fdbf903126300bcb6f04",
        "63a5fdff903126300bcb7576",
        "654ae90f931d182cc6c7f4d6",
        "654a7738931d182cc6c7e5d5",
        "654934d9931d182cc6c7d2d8",
        "654922b2931d182cc6c7d20b",
        "6548fa0d931d182cc6c7d0bf",
        "65449017931d182cc6c79dee",
        "6543e54b931d182cc6c78fad",
        "6542702d931d182cc6c77b11",
        "6541dccc931d182cc6c77989",
        "65415516931d182cc6c76c95",
        "653ff745931d182cc6c75ac8",
        "653bd407931d182cc6c72dba",
        "653bd0f5931d182cc6c72d7c",
        "653b018e931d182cc6c72c73",
        "653aba7e931d182cc6c71e72",
        "653ab96b931d182cc6c71e36",
        "653ab43a931d182cc6c71cf7",
        "653ab25f931d182cc6c71c45",
        "653aaf3d931d182cc6c71c05",
        "653983fc931d182cc6c70bb7",
        "65395d84931d182cc6c70a85",
        "6538643f931d182cc6c706d6",
        "6532bb475a8a6edeeb915443",
        "653183872bf94961c3913ef7",
        "6530728d2bf94961c3913bcb",
        "65301fc72bf94961c3912efd",
        "652f687e2bf94961c3912ccd",
        "652e0bfd1d889483a86cdd17",
        "65287eb61d889483a86c9ba9",
        "65241c50c7333532fa6fb7d0",
      ],
    })

    const userData = users.map((u) => {
      const parts = u.name.trim().split(" ") // Split the name into parts, trimming any extra whitespace
      const firstname = parts[0] || "" // The first part is the first name
      const lastname = parts.length > 1 ? parts.slice(1).join(" ") : "" // Join the remaining parts for the last name

      return {
        firstname,
        lastname,
        dob: format(new Date(u.dateOfBirth), "yyyy-MM-dd"),
        gender: u.gender === Gender.Male ? "M" : "F",
        zip: u.address.postalCode,
        city: u.address.city,
        state: u.address.state,
        addressLine1: u.address.line1,
        addressLine2: u.address.line2 || "",
        phone1: u.phone || "",
        email1: u.email,
        phone2: "",
        email2: "",
      }
    })

    const csvWriter = createObjectCsvWriter({
      path: `${Date.now()}-metriport-sheet.csv`,
      header: [
        { id: "firstname", title: "firstname" },
        { id: "lastname", title: "lastname" },
        { id: "dob", title: "dob" },
        { id: "gender", title: "gender" },
        { id: "zip", title: "zip" },
        { id: "city", title: "city" },
        { id: "state", title: "state" },
        { id: "addressLine1", title: "addressLine1" },
        { id: "addressLine2", title: "addressLine2" },
        { id: "phone1", title: "phone1" },
        { id: "email1", title: "email1" },
        { id: "phone2", title: "phone2" },
        { id: "email2", title: "email2" },
      ],
    })

    await csvWriter.writeRecords(userData)

    console.log("report is ready!")
  } catch (error) {
    console.log(error)
  }
}

connectToMongo()
getPatientMetriportList()

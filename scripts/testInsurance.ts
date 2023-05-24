import prepareShellEnvironment from "./utils/prepareShellEnvironment"
import { authenticate, getSavedAuthorizationToken } from "../src/utils/candid"

async function testInsurance() {
  await prepareShellEnvironment()

  console.log(JSON.stringify(await authenticate()))
  console.log(JSON.stringify(await getSavedAuthorizationToken()))

  process.exit(0)
}

testInsurance()

import prepareShellEnvironment from "./utils/prepareShellEnvironment"
import { findAndTriggerEntireSendBirdFlowForAllUsersAndProvider } from "../src/utils/sendBird"

async function recreateSendBirdObjects() {
  await prepareShellEnvironment()

  await findAndTriggerEntireSendBirdFlowForAllUsersAndProvider()
}

recreateSendBirdObjects()

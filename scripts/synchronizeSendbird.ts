import { Command } from "commander"
import prepareShellEnvironment from "./utils/prepareShellEnvironment"
import {
  findAndTriggerEntireSendBirdFlowForAllUsersAndProvider,
  getMessagesInChannel,
  getSendBirdCollection,
  getSendBirdEntity,
  getSendBirdUserChannels,
} from "../src/utils/sendBird"

const program = new Command()

program.description(
  "Synchronizes the sendbird state to be in sync with the database. Only removes unused items from sendbird."
)

program.parse()

async function synchronizeSendbird() {
  await prepareShellEnvironment()

  await findAndTriggerEntireSendBirdFlowForAllUsersAndProvider()

  console.log("Script complete.")
}

synchronizeSendbird()

import { TaskModel } from './schema/task.schema';
import { UserTaskModel } from './schema/task.user.schema';
import { protocol } from "./utils/protocol";

import * as Sentry from "@sentry/node";
import {
  ApolloServerPluginLandingPageGraphQLPlayground,
  ApolloServerPluginLandingPageProductionDefault
} from "apollo-server-core";
import { ApolloServer } from "apollo-server-express";
import * as AWS from "aws-sdk";
import crypto from "crypto";
import dotenv from "dotenv";
import express from "express";
import { expressjwt } from "express-jwt";
import { ChatCompletionRequestMessageRoleEnum, Configuration, OpenAIApi } from "openai";
import "reflect-metadata";
import { buildSchema } from "type-graphql";
import authChecker from "./middleware/authChecker";
import resolvers from "./resolvers";
import { ProviderModel } from "./schema/provider.schema";
import { Role, UserModel } from "./schema/user.schema";
import AkuteService from './services/akute.service';
import Context from "./types/context";
import { connectToMongo } from "./utils/mongo";
dotenv.config()

// import * as Tracing from '@sentry/tracing';
Sentry.init({
  dsn: "https://e99c3274029e405f9e1b6dd50a63fd85@o4504040965603328.ingest.sentry.io/4504040986705920",
  environment: process.env.NODE_ENV,
  // Set tracesSampleRate to 1.0 to capture 100%
  // of transactions for performance monitoring.
  // We recommend adjusting this value in production
  tracesSampleRate: 1.0,
})
type WeightEntry = {
  date: Date;
  value: number;
};

function findTwoMostRecentWeights(weights: WeightEntry[]): [WeightEntry | null, WeightEntry | null] {
  const today = new Date();
  let mostRecentEntry: WeightEntry | null = null;
  let secondMostRecentEntry: WeightEntry | null = null;

  weights.forEach((entry) => {
    const entryDate = new Date(entry.date);
    if (entryDate <= today) {
      if (mostRecentEntry === null || entryDate > mostRecentEntry.date) {
        secondMostRecentEntry = mostRecentEntry;
        mostRecentEntry = entry;
      } else if (secondMostRecentEntry === null || entryDate > secondMostRecentEntry.date) {
        secondMostRecentEntry = entry;
      }
    }
  });

  return [mostRecentEntry, secondMostRecentEntry];
}

async function bootstrap() {
  const path = "/graphql"

  // build the schema
  const schema = await buildSchema({
    resolvers,
    authChecker,
  })

  // init express
  const app = express()
  app.use(express.json())

  // create the apollo server
  const server = new ApolloServer({
    schema,
    context: (ctx: Context) => {
      const context = ctx.req
      // req.user is set by the jwt middleware
      context.user = ctx.req.auth
      return context
    },
    plugins: [
      process.env.NODE_ENV === "production"
        ? ApolloServerPluginLandingPageProductionDefault()
        : ApolloServerPluginLandingPageGraphQLPlayground(),
    ],
  })

  // mount jwt middleware & run before the GraphQL execution
  app.use(
    path,
    expressjwt({
      secret: process.env.JWT_SECRET,
      credentialsRequired: false,
      algorithms: ["HS256"],
    })
  )
  const configuration = new Configuration({
    apiKey: process.env.OPEN_AI_KEY || "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",
  });

  app.post("/protocol", async (req: any, res: any) => {
    try {
      const akuteService = new AkuteService()
      const openAi = new OpenAIApi(configuration)
      const user = await UserModel.findById(req.body.userId)
      const allUserTasks = await UserTaskModel.find({ user: req.body.userId })

      // the userTasks array of objects only has the task id, so we needto find the actual task type in order to group each task by type the task type lives on the TaskModel.
      const findAndGroupTasks = async (userTasks: any) => {
        const tasks = await Promise.all(userTasks.map(async (task: any) => {
          const taskType = await TaskModel.findById(task.task);
          return { taskType: taskType.type, task: task };
        }));

        const groupedTasks = tasks.reduce((acc: any, task: any) => {
          const key = task.taskType;
          if (!acc[key]) {
            acc[key] = { mostRecent: task, secondMostRecent: null };
          } else {
            if (new Date(task.task.completedAt) > new Date(acc[key].mostRecent.task.completedAt)) {
              acc[key].secondMostRecent = acc[key].mostRecent;
              acc[key].mostRecent = task;
            } else if (
              acc[key].secondMostRecent === null ||
              new Date(task.task.completedAt) > new Date(acc[key].secondMostRecent.task.completedAt)
            ) {
              acc[key].secondMostRecent = task;
            }
          }
          return acc;
        }, {});

        return groupedTasks;
      };
      const groupedTasks = await findAndGroupTasks(allUserTasks);
      const mostRecentWeights = findTwoMostRecentWeights(user?.weights || [])
      const mostRecentBp = groupedTasks.BP_LOG
      const mostRecentGsrs = groupedTasks.GSRS

      const subTypes = user?.classifications
      const weights = groupedTasks.WEIGHT_LOG;
      const weight1 = parseFloat(weights.mostRecent.task.answers.find((answer: any) => answer.key === "weight")?.value);
      const weight2 = parseFloat(weights.secondMostRecent.task.answers.find((answer: any) => answer.key === "weight")?.value);
      const weightChange = weight1 && weight2 ? (((weight1 - weight2) / weight2) * 100).toFixed(2) : null;


      const medicationsFromAkute = await akuteService.getASinglePatientMedications(user?.akutePatientId);
      const activeMedications = medicationsFromAkute.filter((medication: any) => medication.status === 'active')
      // Updated code to extract medication name and dose
      const medicationsAndStrength = activeMedications.map((medication: any) => {
        const medicationName = medication.generic_name
        const medicationStrength = medication.strength
        return `${medicationName} ${medicationStrength}`
      })
      const medications = medicationsAndStrength.join(', ')

      const subTypesText = subTypes.map((subtype, index) => {
        const classification = subtype.classification;
        const percentile = subtype.percentile;
        return `Classification ${index + 1}: ${classification} (${percentile}%)`;
      }).join(', ');

      const prompt = `This Patient has the following classifications and percentiles: ${subTypesText}. They have lost ${weightChange}% over the past 4 weeks and are currently on this or these doses of medication: ${medications}`

      console.log(prompt);

      const params = {
        model: "gpt-4",
        temperature: 0,
        messages: [
          {
            role: ChatCompletionRequestMessageRoleEnum.System,
            content: "Act as a medical assistant for an obesity clinic. This is a novel protocol using data from patients to recommend certain drugs and titrations. Your job is to recommend the medication and dose dictated by this protocol, as well as any recommended changes to current medications if they are weight gain causes.Do not include any extraneous information in your response.Ignore duplicate medications."
          },
          {
            role: ChatCompletionRequestMessageRoleEnum.User,
            content: `Protocol: ${protocol} question: ${prompt}`,
          }
        ],
      }
      const completion = await openAi.createChatCompletion(params, {
        headers: {
          "OpenAI-Organization": "org-QoMwwdaIbJ7OUvpSZmPZ42Y4",
        },
      })

      res.send(completion.data.choices[0].message.content)
    } catch (error) {
      console.log(error)
      res.send(error)
      return error
    }

  })
  // start apollo server
  await server.start()

  // apply middleware to server
  server.applyMiddleware({
    app,
    path,
  })
  const ses = new AWS.SES({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION,
  })
  // webhook listener
  app.post("/sendbirdWebhooks", express.text({ type: "json" }), async (req, res) => {
    try {
      const body = JSON.parse(req.body);
      const signature = req.get('x-sendbird-signature');
      const hash = crypto.createHmac("sha256", process.env.SENDBIRD_API_TOKEN).update(req.body).digest('hex');

      const { sender, payload: { message }, members } = body
      const foundUserEmailAddresses = members.map(async (member: any) => {
        const foundEmails = []
        const emailsToSendTo = await UserModel.findOne({ _id: member.user_id })
        foundEmails.push(emailsToSendTo)
        if (!emailsToSendTo) {
          const foundOnProviderTable = await ProviderModel.findOne({ _id: member.user_id })
          foundEmails.push(foundOnProviderTable)
        }
        return foundEmails
      })
      const emailsToSendTo = (await Promise.all(foundUserEmailAddresses)).flat()
      const filteredEmailsToSendTo = emailsToSendTo.filter(email => email !== null)
      const possibleSender = await UserModel.findOne({ _id: sender.user_id })
      if (possibleSender?.role === Role.Patient) {
        const filteredEmailsToSendToBasedOnRole = filteredEmailsToSendTo.filter(user => String(user._id) !== String(possibleSender._id))
        const mapToEmails = filteredEmailsToSendToBasedOnRole.map((user: any) => user.email)
        const params = {
          Source: "no-reply@joinalfie.com",
          Destination: {
            ToAddresses: mapToEmails,
          },
          ReplyToAddresses: [] as string[],
          Message: {
            Body: {
              Html: {
                Charset: "UTF-8",
                Data: `
          You have unread messages from ${sender.nickname}
                    <br />
          <br />
          Sender: ${sender.nickname}
          <br />
          <br />
          Message: ${message}
          .          
          `
              },
            },
            Subject: {
              Charset: "UTF-8",
              Data: `Unread Messages in Channel by ${sender.nickname}`,
            },
          },
        }
        await ses.sendEmail(params).promise()
        return res.sendStatus(200)
      } else {
        // this is an admin, health coach or practitioner so we just send the email to the patient
        const filteredEmailsToSendToBasedOnRole = filteredEmailsToSendTo.filter(user => user.type !== Role.Practitioner && user.role !== Role.Admin && user.role !== Role.HealthCoach)
        const mapToEmails = filteredEmailsToSendToBasedOnRole.map((user: any) => user.email)
        const params = {
          Source: "no-reply@joinalfie.com",
          Destination: {
            ToAddresses: mapToEmails,
          },
          ReplyToAddresses: [] as string[],
          Message: {
            Body: {
              Html: {
                Charset: "UTF-8",
                Data: `
                Hi ${filteredEmailsToSendToBasedOnRole[0]?.name},

                  You have a new message from your Care Team. To read it, simply click the button below:
                  <br />
                  <br />

                  <a href="https://app.joinalfie.com/chat">Read Message</a>

                  <br />
                  <br />
                  
                  If you have any questions, let us know through the messaging portal!

                  <br />
                  <br />
                  Your Care Team`
              },
            },
            Subject: {
              Charset: "UTF-8",
              Data: "New Message from your Care Team",
            },
          },
        }
        await ses.sendEmail(params).promise()
      }
      signature == hash ? res.sendStatus(200) : res.sendStatus(401)
    } catch (error) {
      console.log(error, "error")
      res.sendStatus(500)
    }
  })


  // app.listen on express server
  app.listen({ port: process.env.PORT || 4000 }, () => {
    console.log(
      `App is listening on http://localhost:4000${server.graphqlPath}`
    )
  })

  // connect to mongodb
  connectToMongo()
}

bootstrap()

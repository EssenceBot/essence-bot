import { Client, Events, GatewayIntentBits } from "discord.js";
import { initialModuleImport, lateModuleImport } from "./lib/modules";
import { connect } from "./api/db";
import type { RESTPostAPIChatInputApplicationCommandsJSONBody } from "discord-api-types/v10";
import type Surreal from "surrealdb";
import chalk from "chalk";
import { EventEmitter } from "events";

EventEmitter.defaultMaxListeners = 100;

export const bot = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
  ],
});

export let loadedModules: string[] = [];
export let commandsList: RESTPostAPIChatInputApplicationCommandsJSONBody[] = [];

console.log(`${chalk.green("[Core]")} Bot is starting...`);
console.log(`${chalk.green("[Core]")} Connecting to database...`);
const dbConnection = await connect();
if (!dbConnection) {
  throw new Error("[Core] Failed to connect to the database");
}
console.log(`${chalk.green("[Core]")} Successfully connected to database`);
export const db: Surreal = dbConnection;
console.log(`${chalk.green("[Core]")} Importing modules...`);
await initialModuleImport();
console.log(
  `${chalk.green("[Core]")} Loaded modules: [${loadedModules.join(", ")}]`
);

bot.once(Events.ClientReady, async (_readyClient) => {
  console.log(`${chalk.green("[Core]")} Importing late module functions...`);
  await lateModuleImport();
  console.log(`${chalk.green("[Core]")} Importing commands...`);
  bot.application?.commands.set(commandsList);
  console.log(
    `${chalk.green("[Core]")} Commands imported: ${commandsList.length}`
  );
  console.log(`${chalk.green("[Core]")} Bot is ready`);
});

bot.login(process.env.DISCORD_TOKEN);

import { Client, Events, GatewayIntentBits } from "discord.js";
import { initialModuleImport, lateModuleImport } from "~/lib/modules";
import type { RESTPostAPIChatInputApplicationCommandsJSONBody } from "discord-api-types/v10";
import botLog from "~/lib/log";
import { EventEmitter } from "events";
import { initializeDatabase } from "~/lib/database/index";

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

botLog("Core", "Bot is starting...");
if (!process.env.DISCORD_TOKEN) {
  botLog("Core", "DISCORD_TOKEN environment variable not set", "error");
  process.exit(1);
}

// Initialize database if configured
botLog("Core", "Connecting to database...");
const databaseInitialized = await initializeDatabase();

if (databaseInitialized) {
  botLog("Core", "Database connected and initialized");
} else {
  botLog(
    "Core",
    "Database not configured, continuing without database support"
  );
}

botLog("Core", "Importing modules...");
await initialModuleImport();
botLog("Core", `Loaded modules: [${loadedModules.join(", ")}]`);

bot.once(Events.ClientReady, async (_readyClient) => {
  botLog("Core", `Logged in as ${_readyClient.user.tag}`);
  botLog("Core", "Importing late module functions...");
  await lateModuleImport();
  botLog("Core", "Importing commands...");
  bot.application?.commands.set(commandsList);
  botLog("Core", `Commands imported: ${commandsList.length}`);
  botLog("Core", "Bot is ready");
});

bot.login(process.env.DISCORD_TOKEN);

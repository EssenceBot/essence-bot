import { Client, Events, GatewayIntentBits } from "discord.js";
import { initialModuleImport } from "./lib/modules";
import type { RESTPostAPIChatInputApplicationCommandsJSONBody } from "discord-api-types/v10";

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

console.log("Bot is starting...");
console.log("importing modules...");
await initialModuleImport();
console.log(`Loaded modules: [${loadedModules.join(", ")}]`);


bot.once(Events.ClientReady, async _readyClient => {
  console.log("importing commands...")
  bot.application?.commands.set(commandsList);
  console.log(`Commands imported: ${commandsList.length}`);
  console.log("Bot is ready");
}); 

bot.login(process.env.DISCORD_TOKEN);

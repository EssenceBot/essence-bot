import { bot, commandsList } from "~/index";
import { SlashCommandBuilder } from "@discordjs/builders";
import type { ChatInputCommandInteraction, Message } from "discord.js";
import { Events } from "discord.js";
import {
  getDatabase,
  isDatabaseEnabled,
  registerModuleSchema,
} from "~/lib/database/index";
import type { DatabaseSchema } from "~/types/types";

export async function createSlashCommand(
  slashCommandHandler: (slashCommand: SlashCommandBuilder) => void,
  interactionHandler: (interaction: ChatInputCommandInteraction) => void
) {
  const slashCommand = new SlashCommandBuilder();
  slashCommandHandler(slashCommand);
  bot.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName === slashCommand.name) {
      interactionHandler(interaction);
    }
  });
  commandsList.push(slashCommand.toJSON());
}

export async function createChannelMessageListener(
  channelId: string,
  messageHandler: (message: Message) => void
) {
  bot.on(Events.MessageCreate, async (message) => {
    if (message.channelId === channelId) {
      messageHandler(message);
    }
  });
}

export async function removeChannelMessageListener(
  channelId: string,
  messageHandler: (message: Message) => void
) {
  bot.off(Events.MessageCreate, async (message) => {
    if (message.channelId === channelId) {
      messageHandler(message);
    }
  });
}

export function getClient() {
  return bot;
}

// Database API functions
export function getDatabaseClient() {
  if (!isDatabaseEnabled()) {
    throw new Error(
      "Database is not enabled. Please configure database environment variables."
    );
  }
  return getDatabase();
}

export function isDatabaseAvailable(): boolean {
  return isDatabaseEnabled();
}

export function registerSchema(moduleName: string, schema: DatabaseSchema) {
  registerModuleSchema(moduleName, schema);
}

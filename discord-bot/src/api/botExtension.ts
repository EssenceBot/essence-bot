import { bot } from "../index";
import { SlashCommandBuilder } from '@discordjs/builders';
import type { CommandInteraction } from 'discord.js';
import { Events } from "discord.js";
import { commandsList } from "../index";

export async function createSlashCommand(slashCommandHandler: (slashCommand: SlashCommandBuilder) => void, interactionHandler: (interaction: CommandInteraction) => void) {
    const slashCommand = new SlashCommandBuilder();
    slashCommandHandler(slashCommand);
    bot.on(Events.InteractionCreate, async interaction => {
        if (!interaction.isCommand()) return;
        if (interaction.commandName === slashCommand.name) {
            interactionHandler(interaction);
        }
    });
    commandsList.push(slashCommand.toJSON());
}

export function getClient() {
    return bot;
}

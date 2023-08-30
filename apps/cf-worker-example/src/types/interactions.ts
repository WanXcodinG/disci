import type { ChatInputInteraction } from "disci";

export interface SlashCommand {
    name: string;
    description: string;
    run: (interaction: ChatInputInteraction) => unknown
}
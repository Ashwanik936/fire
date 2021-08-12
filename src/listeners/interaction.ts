import {
  MessageComponentInteraction,
  ContextMenuInteraction,
  Interaction,
} from "discord.js";
import { ApplicationCommandMessage } from "@fire/lib/extensions/appcommandmessage";
import { ContextCommandMessage } from "@fire/lib/extensions/contextcommandmessage";
import { CommandInteraction } from "@fire/lib/extensions/commandinteraction";
import { ComponentMessage } from "@fire/lib/extensions/componentmessage";
import { GuildTagManager } from "@fire/lib/util/guildtagmanager";
import { FireGuild } from "@fire/lib/extensions/guild";
import { constants } from "@fire/lib/util/constants";
import { FireUser } from "@fire/lib/extensions/user";
import { Listener } from "@fire/lib/util/listener";

const { emojis } = constants;

export default class InteractionListener extends Listener {
  constructor() {
    super("interaction", {
      emitter: "client",
      event: "interactionCreate",
    });
  }

  async exec(interaction: Interaction) {
    if (this.blacklistCheck(interaction)) return;
    else if (interaction.isCommand())
      return await this.handleApplicationCommand(
        interaction as CommandInteraction
      );
    // todo: add this lol
    else if (interaction.isContextMenu()) return;
    else if (
      interaction.isMessageComponent() &&
      interaction.componentType == "BUTTON"
    )
      return await this.handleButton(interaction);
    else if (
      interaction.isMessageComponent() &&
      interaction.componentType == "SELECT_MENU"
    )
      return await this.handleSelect(interaction);
  }

  async handleApplicationCommand(command: CommandInteraction) {
    try {
      // should be cached if in guild or fetch if dm channel
      await this.client.channels.fetch(command.channelId).catch(() => {});
      if (!this.client.channels.cache.has(command.channelId))
        return await command.reply(
          `${emojis.error} I was unable to find the channel you are in. If it is a private thread, you'll need to mention me to add me to the thread or give me \`Manage Threads\` permission`
        ); // could be a private thread fire can't access
      if (command.guild && !command.guild?.tags) {
        command.guild.tags = new GuildTagManager(this.client, command.guild);
        await command.guild.tags.init();
      }
      const message = new ApplicationCommandMessage(this.client, command);
      await message.channel.ack((message.flags & 64) != 0);
      if (!message.command) {
        this.client.console.warn(
          `[Commands] Got slash command request for unknown command, /${command.commandName}`
        );
        return await message.error("UNKNOWN_COMMAND");
      } else if (!message.guild && message.command.channel == "guild")
        return await message.error("SLASH_COMMAND_BOT_REQUIRED", {
          invite: this.client.config.inviteLink,
        });
      await message.generateContent();
      // @ts-ignore
      await this.client.commandHandler.handle(message);
      // if (message.sent != "message")
      //   await message.sourceMessage?.delete().catch(() => {});
    } catch (error) {
      const guild = this.client.guilds.cache.get(command.guildId);
      if (!guild)
        await this.error(command, error).catch(() => {
          command.reply(`${emojis.error} Something went wrong...`);
        });
      if (typeof this.client.sentry != "undefined") {
        const sentry = this.client.sentry;
        sentry.setExtras({
          slashCommand: JSON.stringify(command),
          member: command.member
            ? `${command.member.user.username}#${command.member.user.discriminator}`
            : `${command.user.username}#${command.user.discriminator}`,
          channel_id: command.channelId,
          guild_id: command.guildId,
          env: process.env.NODE_ENV,
        });
        sentry.captureException(error);
        sentry.setExtras(null);
        sentry.setUser(null);
      }
    }
  }

  async handleButton(button: MessageComponentInteraction) {
    try {
      // should be cached if in guild or fetch if dm channel
      await this.client.channels.fetch(button.channelId).catch(() => {});
      const message = new ComponentMessage(this.client, button);
      if (message.customId.startsWith("?")) await message.channel.defer(true);
      if (
        !message.customId.startsWith("!") &&
        !message.customId.startsWith("?")
      )
        await message.channel.ack();
      else message.customId = message.customId.slice(1);
      this.client.emit("button", message);
    } catch (error) {
      await this.error(button, error).catch(() => {
        button.reply(`${emojis.error} Something went wrong...`);
      });
      if (typeof this.client.sentry != "undefined") {
        const sentry = this.client.sentry;
        sentry.setExtras({
          button: JSON.stringify(button),
          member: button.member
            ? `${button.member.user.username}#${button.member.user.discriminator}`
            : `${button.user.username}#${button.user.discriminator}`,
          channel_id: button.channelId,
          guild_id: button.guildId,
          env: process.env.NODE_ENV,
        });
        sentry.captureException(error);
        sentry.setExtras(null);
        sentry.setUser(null);
      }
    }
  }

  async handleSelect(select: MessageComponentInteraction) {
    try {
      // should be cached if in guild or fetch if dm channel
      await this.client.channels.fetch(select.channelId).catch(() => {});
      const message = new ComponentMessage(this.client, select);
      if (!message.customId.startsWith("!")) await message.channel.ack();
      else message.customId = message.customId.slice(1);
      this.client.emit("select", message);
    } catch (error) {
      await this.error(select, error).catch(() => {
        select.reply(`${emojis.error} Something went wrong...`);
      });
      if (typeof this.client.sentry != "undefined") {
        const sentry = this.client.sentry;
        sentry.setExtras({
          button: JSON.stringify(select),
          member: select.member
            ? `${select.member.user.username}#${select.member.user.discriminator}`
            : `${select.user.username}#${select.user.discriminator}`,
          channel_id: select.channelId,
          guild_id: select.guildId,
          env: process.env.NODE_ENV,
        });
        sentry.captureException(error);
        sentry.setExtras(null);
        sentry.setUser(null);
      }
    }
  }

  async handleContextMenu(context: ContextMenuInteraction) {
    try {
      // should be cached if in guild or fetch if dm channel
      await this.client.channels.fetch(context.channelId).catch(() => {});
      if (!this.client.channels.cache.has(context.channelId))
        return await context.reply(
          `${emojis.error} I was unable to find the channel you are in. If it is a private thread, you'll need to mention me to add me to the thread or give me \`Manage Threads\` permission`
        ); // could be a private thread fire can't access
      const message = new ContextCommandMessage(this.client, context);
      await message.channel.ack((message.flags & 64) != 0);
      if (!message.command) {
        this.client.console.warn(
          `[Commands] Got application command request for unknown context menu, ${context.commandName}`
        );
        return await message.error("UNKNOWN_COMMAND");
      } else if (!message.guild && message.command.channel == "guild")
        return await message.error("SLASH_COMMAND_BOT_REQUIRED", {
          invite: this.client.config.inviteLink,
        });
      await message.generateContent();
      // @ts-ignore
      await this.client.commandHandler.handle(message);
      // if (message.sent != "message")
      //   await message.sourceMessage?.delete().catch(() => {});
    } catch (error) {
      const guild = this.client.guilds.cache.get(context.guildId);
      if (!guild)
        await this.error(context, error).catch(() => {
          context.reply(`${emojis.error} Something went wrong...`);
        });
      if (typeof this.client.sentry != "undefined") {
        const sentry = this.client.sentry;
        sentry.setExtras({
          contextCommand: JSON.stringify(context),
          member: context.member
            ? `${context.member.user.username}#${context.member.user.discriminator}`
            : `${context.user.username}#${context.user.discriminator}`,
          channel_id: context.channelId,
          guild_id: context.guildId,
          env: process.env.NODE_ENV,
        });
        sentry.captureException(error);
        sentry.setExtras(null);
        sentry.setUser(null);
      }
    }
  }

  async error(
    interaction:
      | CommandInteraction
      | ContextMenuInteraction
      | MessageComponentInteraction,
    error: Error
  ) {
    return interaction.reply({
      content: `${emojis.error} An error occured while trying to handle this interaction that may be caused by being in DMs or the bot not being present...

      If this is a slash command, try inviting the bot to a server (<${this.client.config.inviteLink}>) if you haven't already and try again.
      
      Error Message: ${error.message}`,
      ephemeral: true,
    });
  }

  blacklistCheck(interaction: Interaction) {
    const guild = interaction.guild as FireGuild;
    const user = interaction.user as FireUser;

    return this.client.util.isBlacklisted(
      user,
      guild,
      interaction.isCommand() ? interaction.commandName : null
    );
  }
}

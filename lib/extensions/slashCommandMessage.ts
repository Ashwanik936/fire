import {
  APIMessageContentResolvable,
  PermissionOverwriteOption,
  GuildMemberResolvable,
  AwaitMessagesOptions,
  MessageEditOptions,
  MessageResolvable,
  MessageAttachment,
  StringResolvable,
  MessageAdditions,
  CollectorFilter,
  MessageMentions,
  MessageReaction,
  UserResolvable,
  RoleResolvable,
  MessageOptions,
  MessageManager,
  MessageEmbed,
  Permissions,
  NewsChannel,
  APIMessage,
  Collection,
  DMChannel,
  Snowflake,
} from "discord.js";
import { SlashCommand } from "@fire/lib/interfaces/slashCommands";
import { ArgumentOptions, Command } from "@fire/lib/util/command";
import { CommandUtil } from "@fire/lib/util/commandutil";
import { constants } from "@fire/lib/util/constants";
import { Language } from "@fire/lib/util/language";
import { FireTextChannel } from "./textchannel";
import { FireMember } from "./guildmember";
import { FireMessage } from "./message";
import { Fire } from "@fire/lib/Fire";
import { FireGuild } from "./guild";
import { FireUser } from "./user";

const { emojis, reactions } = constants;

export class SlashCommandMessage {
  realChannel?: FireTextChannel | NewsChannel | DMChannel;
  attachments: Collection<string, MessageAttachment>;
  sent: false | "ack" | "message";
  sourceMessage: FireMessage;
  slashCommand: SlashCommand;
  mentions: MessageMentions;
  latestResponse: string;
  channel: FakeChannel;
  member?: FireMember;
  language: Language;
  guild?: FireGuild;
  util: CommandUtil;
  command: Command;
  author: FireUser;
  content: string;
  flags: number;
  client: Fire;
  id: string;

  constructor(client: Fire, command: SlashCommand) {
    this.client = client;
    this.id = command.id;
    this.slashCommand = command;
    if (command.data.options?.length && command.data.options[0]?.type == 1) {
      command.data.name = `${command.data.name}-${command.data.options[0].name}`;
      command.data.options = command.data.options[0].options;
    }
    this.guild = client.guilds.cache.get(command.guild_id) as FireGuild;
    this.command = this.client.getCommand(command.data.name);
    this.flags = 0;
    if (this.guild?.tags?.slashCommands[command.data.id] == command.data.name) {
      this.command = this.client.getCommand("tag");
      command.data.options = [{ name: "tag", value: command.data.name }];
      if (this.guild.tags.ephemeral) this.setFlags(64);
    }
    if (this.command?.ephemeral) this.setFlags(64);
    // @ts-ignore
    this.mentions = new MessageMentions(this, [], [], false);
    this.attachments = new Collection();
    // @mason pls just always include user ty
    const user = command.user ?? command.member?.user;
    this.author =
      (client.users.cache.get(user.id) as FireUser) ||
      new FireUser(client, user);
    if (!client.users.cache.has(this.author.id))
      client.users.add(command.member ? command.member.user : command.user);
    if (this.guild) {
      this.member =
        (this.guild.members.cache.get(this.author.id) as FireMember) ||
        new FireMember(client, command.member, this.guild);
      if (!this.guild.members.cache.has(this.member.id))
        this.guild.members.add(command.member);
    }
    this.language = this.author?.settings.get("utils.language")
      ? this.author.language.id == "en-US" && this.guild?.language.id != "en-US"
        ? this.guild?.language
        : this.author.language
      : this.guild?.language || client.getLanguage("en-US");
    this.realChannel = this.client.channels.cache.get(
      this.slashCommand.channel_id
    ) as FireTextChannel | NewsChannel | DMChannel;
    if (!this.guild) {
      // This will happen if a guild authorizes w/applications.commands
      // or if a slash command is invoked in DMs (discord/discord-api-docs #2568)
      this.channel = new FakeChannel(
        this,
        client,
        command.id,
        command.token,
        command.guild_id ? null : this.author.dmChannel,
        this.flags
      );
      return this;
    }
    this.channel = new FakeChannel(
      this,
      client,
      command.id,
      command.token,
      this.realChannel,
      this.flags
    );
    this.latestResponse = "@original";
    this.sent = false;
  }

  setFlags(flags: number) {
    // Suppress and ephemeral
    if (![1 << 2, 1 << 6].includes(flags)) return;
    this.flags = flags;
  }

  async generateContent() {
    let prefix = (this.client.commandHandler.prefix as (
      message: any
    ) => string | string[] | Promise<string | string[]>)(this);
    if (this.client.util.isPromise(prefix)) prefix = await prefix;
    if (prefix instanceof Array) prefix = prefix[0].trim();
    let content = (prefix as string) + " ";
    content += this.command.id + " ";
    if (this.command.args?.length && this.slashCommand.data.options?.length) {
      const commandArgs = this.command.args as ArgumentOptions[];
      const argNames = this.slashCommand.data.options.map((opt) => opt.name);
      const sortedArgs = this.slashCommand.data.options.sort(
        (a, b) =>
          argNames.indexOf(a.name.toLowerCase()) -
          argNames.indexOf(b.name.toLowerCase())
      );
      let args = sortedArgs.map((opt) => {
        if (
          commandArgs.find(
            (arg) => arg.id == opt.name && arg.flag && arg.match == "flag"
          ) &&
          opt.value
        ) {
          const arg = commandArgs.find((arg) => arg.id == opt.name);
          return arg.flag;
        } else if (commandArgs.find((arg) => arg.id == opt.name && arg.flag))
          return `--${opt.name} ${opt.value}`;
        return opt.value;
      });
      content += args.join(" ");
    }
    this.content = content;
    return this.content;
  }

  send(key: string = "", ...args: any[]) {
    return this.channel.send(this.language.get(key, ...args), {}, this.flags);
  }

  success(
    key: string = "",
    ...args: any[]
  ): Promise<SlashCommandMessage | MessageReaction | void> {
    if (!key) {
      if (this.sourceMessage instanceof FireMessage)
        return this.sourceMessage.react(reactions.success).catch(() => {});
      else
        return this.getRealMessage().then((message) =>
          message.react(reactions.success).catch(() => {
            return this.error("SLASH_COMMAND_HANDLE_SUCCESS");
          })
        );
    }
    return this.channel.send(
      `${emojis.success} ${this.language.get(key, ...args)}`,
      {},
      this.flags ? this.flags : 64
    );
  }

  error(
    key: string = "",
    ...args: any[]
  ): Promise<SlashCommandMessage | MessageReaction | void> {
    if (!key) {
      if (this.sourceMessage instanceof FireMessage)
        return this.sourceMessage.react(reactions.error).catch(() => {});
      else
        return this.getRealMessage().then((message) =>
          message.react(reactions.error).catch(() => {
            return this.error("SLASH_COMMAND_HANDLE_FAIL");
          })
        );
    }
    return this.channel.send(
      `${emojis.error} ${this.language.get(key, ...args)}`,
      {},
      this.flags ? this.flags : 64
    );
  }

  async getRealMessage() {
    if (!this.realChannel) return;

    let messageId = this.latestResponse;
    if (messageId == "@original") {
      // @ts-ignore
      const message = await this.client.api
        // @ts-ignore
        .webhooks(this.client.user.id, this.slashCommand.token)
        .messages(messageId)
        .patch({
          data: {},
        })
        .catch(() => {});
      messageId = message?.id;
    }

    const message = (await this.realChannel.messages
      .fetch(messageId)
      .catch(() => {})) as FireMessage;
    if (message) this.sourceMessage = message;
    return message;
  }

  async edit(
    content:
      | APIMessageContentResolvable
      | MessageEditOptions
      | MessageEmbed
      | APIMessage,
    options?: MessageEditOptions | MessageEmbed
  ) {
    const { data } =
      content instanceof APIMessage
        ? content.resolveData()
        : // @ts-ignore
          APIMessage.create(this, content, options).resolveData();
    // @ts-ignore
    await this.client.api
      // @ts-ignore
      .webhooks(this.client.user.id, this.slashCommand.token)
      .messages(this.latestResponse)
      .patch({
        data,
      })
      .catch(() => {});
    return this;
  }

  async delete() {
    // @ts-ignore
    await this.client.api
      // @ts-ignore
      .webhooks(this.client.user.id, this.slashCommand.token)
      .messages(this.latestResponse)
      .delete()
      .catch(() => {});
  }
}

export class FakeChannel {
  real: FireTextChannel | NewsChannel | DMChannel;
  message: SlashCommandMessage;
  messages: MessageManager;
  msgFlags: number;
  token: string;
  client: Fire;
  id: string;

  constructor(
    message: SlashCommandMessage,
    client: Fire,
    id: string,
    token: string,
    real?: FireTextChannel | NewsChannel | DMChannel,
    msgFlags?: number
  ) {
    this.id = id;
    this.real = real;
    this.token = token;
    this.client = client;
    this.message = message;
    this.msgFlags = msgFlags;
    this.messages = real?.messages;
  }

  toString() {
    return this.real?.toString();
  }

  permissionsFor(memberOrRole: GuildMemberResolvable | RoleResolvable) {
    return this.real instanceof DMChannel
      ? new Permissions(0) // may change to basic perms in the future
      : this.real?.permissionsFor(memberOrRole) || new Permissions(0);
  }

  startTyping(count?: number) {
    return new Promise(() => {});
  }

  stopTyping(force?: boolean) {
    return;
  }

  bulkDelete(
    messages:
      | Collection<Snowflake, FireMessage>
      | readonly MessageResolvable[]
      | number,
    filterOld?: boolean
  ) {
    return this.real instanceof DMChannel
      ? new Collection<string, FireMessage>()
      : this.real?.bulkDelete(messages, filterOld);
  }

  awaitMessages(filter: CollectorFilter, options?: AwaitMessagesOptions) {
    return this.real?.awaitMessages(filter, options);
  }

  updateOverwrite(
    userOrRole: RoleResolvable | UserResolvable,
    options: PermissionOverwriteOption,
    reason?: string
  ) {
    return !(this.real instanceof DMChannel)
      ? this.real?.updateOverwrite(userOrRole, options, reason)
      : false;
  }

  // Acknowledges without sending a message
  async ack(ephemeral = false) {
    if (ephemeral || (this.msgFlags & 64) != 0) return;
    // @ts-ignore
    await this.client.api
      // @ts-ignore
      .interactions(this.id)(this.token)
      .callback.post({
        data: { type: 5, data: { flags: this.msgFlags } },
      })
      .then(() => {
        this.message.sent = "ack";
        const sourceMessage = this.real.messages.cache.find(
          (message) =>
            typeof message.type == "undefined" &&
            message.system &&
            message.author.id == this.message.member.id &&
            message.content.startsWith(
              `</${
                this.message.command.parent
                  ? this.message.command.parent
                  : this.message.command.id
              }:${this.message.slashCommand.data.id}>`
            )
        );
        if (sourceMessage)
          this.message.sourceMessage = sourceMessage as FireMessage;
      })
      .catch(() => (this.message.sent = "ack"));
  }

  async send(
    content: StringResolvable | APIMessage | MessageEmbed,
    options?: MessageOptions | MessageAdditions,
    flags?: number // Used for success/error, can also be set
  ): Promise<SlashCommandMessage> {
    let apiMessage: APIMessage;

    if (content instanceof MessageEmbed) {
      options = {
        ...options,
        embed: content,
      };
      content = null;
    }

    if (content instanceof APIMessage) apiMessage = content.resolveData();
    else {
      apiMessage = APIMessage.create(
        // @ts-ignore
        { client: this.client },
        content,
        options
      ).resolveData();
    }

    const { data, files } = (await apiMessage.resolveFiles()) as {
      data: any;
      files: any[];
    };

    data.flags = this.msgFlags;
    if (typeof flags == "number") data.flags = flags;

    // embeds in ephemeral wen eta
    if (
      (data.embeds?.length ||
        files?.length ||
        this.real instanceof DMChannel) &&
      (data.flags & 64) == 64
    )
      data.flags -= 64;

    if (!this.message.sent)
      // @ts-ignore
      await this.client.api
        // @ts-ignore
        .interactions(this.id)(this.token)
        .callback.post({
          data: {
            type: 4,
            data,
          },
          files,
        })
        .then(() => {
          this.message.sent = "message";
        })
        .catch(() => {});
    else if ((this.message.sent = "ack")) {
      // @ts-ignore
      await this.client.api
        // @ts-ignore
        .webhooks(this.client.user.id)(this.token)
        .messages("@original")
        .patch({
          data,
          files,
        })
        .then(() => {
          if ((data.flags & 64) != 64) this.message.sent = "message";
        })
        .catch(() => {});
    } else {
      // @ts-ignore
      const message = await this.client.api
        // @ts-ignore
        .webhooks(this.client.user.id)(this.token)
        .post({
          data,
          files,
          query: { wait: true },
        })
        .then(() => {
          if ((data.flags & 64) != 64) this.message.sent = "message";
        })
        .catch(() => {});
      if (message?.id) this.message.latestResponse = message.id;
    }
    this.message.getRealMessage().catch(() => {});
    return this.message;
  }
}

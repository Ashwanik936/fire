import {
  PermissionResolvable,
  ThreadChannel,
  MessageEmbed,
  GuildChannel,
  VoiceChannel,
  StageChannel,
  Permissions,
  DMChannel,
} from "discord.js";
import { LanguageKeys } from "@fire/lib/util/language";
import { FireGuild } from "@fire/lib/extensions/guild";
import { titleCase } from "@fire/lib/util/constants";
import { Listener } from "@fire/lib/util/listener";

export default class ChannelUpdate extends Listener {
  constructor() {
    super("channelUpdate", {
      emitter: "client",
      event: "channelUpdate",
    });
  }

  async exec(
    before: GuildChannel | ThreadChannel | DMChannel,
    after: GuildChannel | ThreadChannel | DMChannel
  ) {
    if (after instanceof DMChannel) return;

    before = before as GuildChannel | ThreadChannel;
    after = after as GuildChannel | ThreadChannel;

    const guild = after.guild as FireGuild;
    const muteRole = guild.muteRole;
    const muteCommand = this.client.getCommand("mute");
    if (
      after instanceof GuildChannel &&
      muteRole &&
      !guild.me
        .permissionsIn(after)
        .missing(muteCommand.clientPermissions as PermissionResolvable[])
        .length &&
      (after
        .permissionsFor(muteRole)
        .has(Permissions.FLAGS.USE_PRIVATE_THREADS) ||
        after
          .permissionsFor(muteRole)
          .has(Permissions.FLAGS.USE_PUBLIC_THREADS) ||
        after
          .permissionsFor(muteRole)
          .has(Permissions.FLAGS.REQUEST_TO_SPEAK) ||
        after.permissionsFor(muteRole).has(Permissions.FLAGS.SEND_MESSAGES) ||
        after.permissionsFor(muteRole).has(Permissions.FLAGS.ADD_REACTIONS) ||
        after.permissionsFor(muteRole).has(Permissions.FLAGS.SPEAK))
    )
      await after.permissionOverwrites
        .edit(
          muteRole,
          {
            USE_PRIVATE_THREADS: false,
            USE_PUBLIC_THREADS: false,
            REQUEST_TO_SPEAK: false,
            SEND_MESSAGES: false,
            ADD_REACTIONS: false,
            SPEAK: false,
          },
          {
            reason: guild.language.get("MUTE_ROLE_CREATE_REASON"),
            type: 0,
          }
        )
        .catch(() => {});

    let beforeOverwrites: string[] = [],
      afterOverwrites: string[] = [];

    if (
      before instanceof GuildChannel &&
      after instanceof GuildChannel &&
      before.permissionOverwrites.cache.size !=
        after.permissionOverwrites.cache.size
    ) {
      const beforeRoleOverwrites = before.permissionOverwrites.cache
        .map((overwrite) => overwrite.id)
        .map((id) => guild.roles.cache.get(id))
        .filter((role) => !!role);
      beforeOverwrites = beforeRoleOverwrites.map((role) => role.toString());
      const afterRoleOverwrites = after.permissionOverwrites.cache
        .map((overwrite) => overwrite.id)
        .map((id) => guild.roles.cache.get(id))
        .filter((role) => !!role);
      afterOverwrites = afterRoleOverwrites.map((role) => role.toString());
    }

    const newOverwrites = afterOverwrites.filter(
      (viewer) => !beforeOverwrites.includes(viewer)
    );
    const removedOverwrites = beforeOverwrites.filter(
      (viewer) => !afterOverwrites.includes(viewer)
    );

    const notableChanges =
      before.name != after.name ||
      before.parentId != after.parentId ||
      newOverwrites.length ||
      removedOverwrites.length ||
      // @ts-ignore (cba to do instance checks everywhere, ignoring is easier)
      before.topic != after.topic ||
      // @ts-ignore
      before.region != after.region;

    if (guild.settings.has("log.action") && notableChanges) {
      const language = guild.language;
      const embed = new MessageEmbed()
        .setColor("#2ECC71")
        .setTimestamp()
        .setAuthor(
          language.get("CHANNELUPDATELOG_AUTHOR", {
            type: titleCase(after.type.replace(/_/g, " ")),
            channel: after.name,
          }),
          guild.iconURL({ size: 2048, format: "png", dynamic: true })
        )
        .setFooter(after.id);
      if (before.name != after.name)
        embed.addField(language.get("NAME"), `${before.name} ➜ ${after.name}`);
      if (before.parentId != after.parentId)
        embed.addField(
          language.get("CATEGORY"),
          `${before.parent?.name || "???"} ➜ ${after.parent?.name || "???"}`
        );
      // @ts-ignore
      if (before.topic != after.topic)
        embed.addField(
          language.get("TOPIC"),
          // @ts-ignore
          `${before.topic || language.get("NO_TOPIC")} ➜ ${
            // @ts-ignore
            after.topic || language.get("NO_TOPIC")
          }`
        );
      if (
        (before instanceof VoiceChannel || before instanceof StageChannel) &&
        (after instanceof VoiceChannel || after instanceof StageChannel)
      )
        if (before.rtcRegion != after.rtcRegion) {
          const unknown = language.get("REGION_AUTOMATIC");
          embed.addField(
            language.get("REGION"),
            `${
              language.get(`REGIONS.${before.rtcRegion}` as LanguageKeys) ||
              "???"
            } ➜ ${
              language.get(`REGIONS.${after.rtcRegion}` as LanguageKeys) ||
              "???"
            }`
          );
        }
      if (newOverwrites.length)
        embed.addField(
          language.get("ADDED_OVERWRITES"),
          newOverwrites.join(" - ")
        );
      if (removedOverwrites.length)
        embed.addField(
          language.get("REMOVED_OVERWRITES"),
          removedOverwrites.join(" - ")
        );
      if (embed.fields.length)
        await guild.actionLog(embed, "channel_update").catch(() => {});
    }
  }
}

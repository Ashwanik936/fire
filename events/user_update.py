"""
MIT License
Copyright (c) 2020 GamingGeek

Permission is hereby granted, free of charge, to any person obtaining a copy of this software
and associated documentation files (the "Software"), to deal in the Software without restriction,
including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense,
and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE
FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
"""


from discord.ext import commands
import datetime
import discord
import functools
import traceback


class UserUpdate(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    @commands.Cog.listener()
    async def on_user_update(self, before, after):
        for guild in self.bot.guilds:
            conf = self.bot.get_config(guild)
            badname = conf.get(
                'utils.badname') or f'John Doe {after.discriminator}'
            if before.name != after.name:
                try:
                    member = guild.get_member(after.id)
                    if not member:
                        continue
                    if conf.get('mod.autodecancer') and guild.me.guild_permissions.manage_nicknames:
                        if member.guild_permissions.manage_nicknames:
                            pass
                        else:
                            nick = after.name
                            if not self.bot.isascii(nick.replace('‘', '\'').replace('“', '"').replace('“', '"')):
                                await member.edit(nick=badname, reason=f'Name changed due to auto-decancer. The name contains non-ascii characters (DEBUG: USER_UPDATE)')
                            else:
                                if member.nick and badname in member.nick:
                                    if not self.bot.ishoisted(nick):
                                        await member.edit(nick=None, reason=f'Name is no longer hoisted or "cancerous" (non-ascii characters) (DEBUG: USER_UPDATE)')
                    if conf.get('mod.autodehoist') and guild.me.guild_permissions.manage_nicknames:
                        if member.guild_permissions.manage_nicknames:
                            pass
                        else:
                            nick = after.name
                            if self.bot.ishoisted(nick):
                                await member.edit(nick=badname, reason=f'Name changed due to auto-dehoist. The name starts with a hoisted character (DEBUG: USER_UPDATE)')
                            else:
                                if member.nick and badname in member.nick:
                                    # Technically this should never run because it should already be reset if not hoisted or cancerous
                                    await member.edit(nick=None, reason=f'Name is no longer hoisted or "cancerous" (non-ascii characters) (DEBUG: USER_UPDATE)')
                except Exception:
                    pass


def setup(bot):
    try:
        bot.add_cog(UserUpdate(bot))
        bot.logger.info(f'$GREENLoaded event $CYANUserUpdate!')
    except Exception as e:
        bot.logger.error(
            f'$REDError while loading event $CYAN"UserUpdate"', exc_info=e)

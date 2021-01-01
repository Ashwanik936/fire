"""
MIT License
Copyright (c) 2021 GamingGeek

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
import aiohttp
import discord


class MCStatus(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    @commands.command(description='View the current status of Minecraft services')
    async def mcstatus(self, ctx):
        emotes = {
            'green': '<:yes:534174796888408074>',
            'yellow': '<:maybe:534174796578160640>',
            'red': '<:no:534174796938870792>'
        }
        statuses = {
            'green': 'No Issues',
            'yellow': 'Some Issues',
            'red': 'Service Unavailable'
        }
        services = {
            'minecraft.net': '**Website**',
            'sessionserver.mojang.com': '**Sessions**',
            'authserver.mojang.com': '**Auth**',
            'textures.minecraft.net': '**Skins**',
            'api.mojang.com': '**API**'
        }
        async with aiohttp.ClientSession() as s:
            async with s.get('https://status.mojang.com/check') as r:
                await s.close()
                if r.status == 200:
                    status = await r.json()
                else:
                    return await ctx.error('Failed to check status')
        s = []
        for service in status:
            for name, state in service.items():
                if name in services:
                    s.append(
                        f'{emotes[state]} {services[name]}: {statuses[state]}')
        embed = discord.Embed(color=ctx.author.color, description='\n'.join(s))
        return await ctx.send(embed=embed)


def setup(bot):
    try:
        bot.add_cog(MCStatus(bot))
        bot.logger.info(f'$GREENLoaded $CYAN"mcstatus" $GREENcommand!')
    except Exception as e:
        bot.logger.error(
            f'$REDError while adding command $CYAN"mcstatus"', exc_info=e)

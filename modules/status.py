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


from fire.http import HTTPClient, Route
from discord.ext import commands
import datetime
import discord


class FireStatus(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
        self.bot.http.firestatus = HTTPClient(
            'https://status.gaminggeek.dev/api/v2'
        )
        if not self.bot.dev:
            self.bot.http.statuspage = HTTPClient(
                'https://api.statuspage.io/v1',
                headers={'Authorization': self.bot.config['statuspage']}
            )
            self.last_log = None

    async def get_status(self, cid: str):
        route = Route(
            'GET',
            f'/pages/fhrcp0477jwt/components/{cid}'
        )
        component = await self.bot.http.statuspage.request(route)
        return component['status']

    async def set_status(self, cid: str, status: str = 'operational'):
        self.bot.logger.warn(
            f'$YELLOWSetting status for $CYAN{cid} $YELLOWto $CYAN{status}')
        route = Route(
            'PATCH',
            f'/pages/fhrcp0477jwt/components/{cid}'
        )
        payload = {
            "component": {
                "status": status,
            }
        }
        await self.bot.http.statuspage.request(route, json=payload)

    @commands.command(name='status')
    async def command(self, ctx):
        colors = {
            'none': ctx.author.color,
            'minor': discord.Color.gold(),
            'major': discord.Color.orange(),
            'critical': discord.Color.red(),
            'maintenance': discord.Color.blue()
        }
        emoji = {
            'operational': '<:operational:685538400639385649>',
            'degraded_performance': '<:degraded_performance:685538400228343808>',
            'partial_outage': '<:partial_outage:685538400555499675>',
            'major_outage': '<:major_outage:685538400639385706>',
            'under_maintenance': '<:maintenance:685538400337395743>'
        }
        sroute = Route(
            'GET',
            '/summary.json'
        )
        iroute = Route(
            'GET',
            '/incidents.json'
        )
        try:
            summary = await self.bot.http.firestatus.request(sroute)
            incidents = await self.bot.http.firestatus.request(iroute)
        except Exception:
            return await ctx.error(f'Failed to fetch Fire status (but, as you can tell, I am online)')
        desc = []
        groups = {}
        for c in [c for c in summary['components'] if c['group_id']]:
            if c['group_id'] == 'jmsbww1qjnz5' and c['status'] == 'operational':
                continue
            if c['group_id'] not in groups:
                groups[c['group_id']] = [c]
            else:
                groups[c['group_id']].append(c)
        for c in [c for c in summary['components'] if not c['group_id']]:
            desc.append(
                f'├{emoji[c["status"]]} **{c["name"]}**: {c["status"].replace("_", " ").title()}')
            for s in groups.get(c['id'], []):
                desc.append(
                    f'├─{emoji[s["status"]]} **{s["name"]}**: {s["status"].replace("_", " ").title()}')
        embed = discord.Embed(color=colors[str(summary['status']['indicator'])], title=summary['status']
                              ['description'], timestamp=datetime.datetime.now(datetime.timezone.utc), description='\n'.join(desc))
        incident = incidents['incidents'][0]
        embed.add_field(name='Latest Incident',
                        value=f'[{incident["name"]}]({incident["shortlink"]})\nStatus: **{incident["status"].capitalize()}**', inline=False)
        maintenance = summary.get('scheduled_maintenances', [])
        if len(maintenance) >= 1:
            maintenance = maintenance[0]
            embed.add_field(name='Scheduled Maintenance',
                            value=f'[{maintenance["name"]}]({maintenance["shortlink"]})\nStatus: **{maintenance["status"].replace("_", " ").capitalize()}**', inline=False)
        await ctx.send(embed=embed)


def setup(bot):
    try:
        bot.add_cog(FireStatus(bot))
        bot.logger.info(f'$GREENLoaded $CYANStatus $GREENmodule!')
    except Exception as e:
        bot.logger.error(
            f'$REDError while adding module $CYAN"status"', exc_info=e)

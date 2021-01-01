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

from fire.filters.invite import findinvite
from discord.ext import commands
from fire.push import pushover
import re


class Redirects(commands.Cog, name="Redirects"):
    def __init__(self, bot):
        self.bot = bot

    async def create(self, code: str, url: str, uid: int):
        code = code.lower()
        query = 'SELECT * FROM vanity WHERE redirect IS NOT NULL AND uid=$1;'
        currentuser = await self.bot.db.fetch(query, str(uid))
        if len(currentuser) >= 5 and uid != 287698408855044097:
            raise commands.CommandError('You can only have 5 redirects!')
        con = await self.bot.db.acquire()
        async with con.transaction():
            query = 'INSERT INTO vanity (\"code\", \"redirect\", \"uid\") VALUES ($1, $2, $3);'
            await self.bot.db.execute(query, code, url, str(uid))
        await self.bot.db.release(con)
        await self.bot.get_cog('Vanity URLs').request_fetch(reason=f'Redirect "{code}" was created.')
        return {
            'url': url,
            'uid': uid
        }

    async def delete(self, slug: str):
        self.bot.logger.warn(f'$YELLOWDeleting redirect for slug $CYAN{slug}')
        current = await self.bot.db.fetch(
            'SELECT * FROM vanity WHERE code=$1;',
            slug
        )
        if current:
            con = await self.bot.db.acquire()
            async with con.transaction():
                query = 'DELETE FROM vanity WHERE code = $1;'
                await self.bot.db.execute(query, slug)
            await self.bot.db.release(con)
            await self.bot.get_cog('Vanity URLs').request_fetch(reason=f'Redirect "{slug}" was deleted.')

    @commands.command(name='redirect', description='Creates a custom redirect for a URL using https://inv.wtf/')
    @commands.has_permissions(administrator=True)
    @commands.guild_only()
    async def makeredirect(self, ctx, slug: str = None, url: str = None):
        if not ctx.guild.id in self.bot.premium_guilds:
            return await ctx.error('This feature is premium only! You can learn more at <https://gaminggeek.dev/premium>')
        if not slug:
            return await ctx.error('You must provide a slug!')
        if not url:
            return await ctx.error('You must provide a url or "delete" to delete an existing redirect!')
        if url.lower() in ['remove', 'delete', 'true', 'yeet', 'disable']:
            current = await self.bot.get_vanity(slug.lower())
            if not current or 'uid' not in current:
                return await ctx.error('Redirect not found!')
            if current['uid'] != str(ctx.author.id):
                return await ctx.error('You can only delete your own redirects!')
            await self.delete(slug.lower())
            return await ctx.success('Redirect deleted!')
        if 'https://' not in url:
            return await ctx.error('URL must include "https://"')
        if findinvite(url):
            return await ctx.error('Redirects cannot be used for invite links')
        if not re.fullmatch(r'[a-zA-Z0-9]+', slug):
            return await ctx.error('Redirect slugs can only contain characters A-Z0-9')
        if len(slug) < 3 or len(slug) > 20:
            return await ctx.error('The slug needs to be 3-20 characters!')
        query = 'SELECT * FROM vanity WHERE code=$1;'
        exists = await self.bot.db.fetch(query, slug.lower())
        if exists:
            return await ctx.error('This slug is already in use!')
        redir = await self.create(slug.lower(), url, ctx.author.id)
        if redir:
            await ctx.success(f'Your redirect is https://inv.wtf/{slug.lower()}')
            author = str(ctx.author).replace('#', '%23')
            if not self.bot.dev:
                # TODO setup slack
                await pushover(f'{author} ({ctx.author.id}) has created the redirect `{slug}` for {url}', url=url, url_title='Check out redirect')
            else:
                await pushover(f'{author} ({ctx.author.id}) has created the redirect `{slug}` for {url}', url=url, url_title='Check out redirect')
        else:
            return await ctx.error('Something went wrong...')


def setup(bot):
    bot.add_cog(Redirects(bot))
    bot.logger.info(f'$GREENLoaded $CYANRedirects $GREENmodule!')

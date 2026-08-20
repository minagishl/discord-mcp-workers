# Discord MCP for Cloudflare Workers

Full Discord API access through the [Model Context Protocol (MCP)](https://modelcontextprotocol.io/), deployed on [Cloudflare Workers](https://developers.cloudflare.com/workers/). Built on Cloudflare’s official [remote-mcp-authless](https://github.com/cloudflare/ai/tree/main/demos/remote-mcp-authless) template (`McpAgent` + Durable Objects).

## Features

- **200 MCP tools** covering Discord REST API v10 resources used by bots
- **Servers & members** — roles, emojis, stickers, soundboard, members, bans, prune, audit log
- **Messages** — read/send/edit/delete, embeds, polls, pins, search, bulk delete, attachments, components, stickers
- **Channels** — text/voice/announcement/forum/stage/media, permissions, invites, positions
- **Threads, webhooks, events, automod, stage, voice, templates, slash commands**

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [pnpm](https://pnpm.io/installation)
- A [Cloudflare account](https://dash.cloudflare.com/sign-up)
- A [Discord bot](https://discord.com/developers/applications) token

### Discord bot setup

1. Create an application in the [Discord Developer Portal](https://discord.com/developers/applications).
2. **Bot** → reset token and copy it.
3. Enable intents as needed:
    - **Message Content Intent** — reading message bodies
    - **Server Members Intent** — `discord_list_members` / member search
4. Copy your **Application ID** from **OAuth2** → **General** (Developer Portal).
5. Invite the bot to your server — replace `YOUR_CLIENT_ID` in the URL below:

```
https://discord.com/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=1495454280919&scope=bot
```

This sets the `bot` scope and a broad permission set used by the MCP tools. Narrow it with the [permission calculator](https://discordapi.com/permissions.html) if preferred. Some tools (slash command _execution_, component clicks) still need Gateway/HTTP Interactions hosting — registration and follow-up REST tools are included.

## Quick start

### Install

```bash
pnpm install
cp .dev.vars.example .dev.vars
# Set DISCORD_BOT_TOKEN (or DISCORD_TOKEN) in .dev.vars
```

### Local development

```bash
pnpm dev
```

- Health: `http://localhost:8787/health`
- MCP (Streamable HTTP): `http://localhost:8787/mcp`
- MCP (SSE): `http://localhost:8787/sse`

### Deploy

```bash
pnpm exec wrangler secret put DISCORD_BOT_TOKEN
pnpm deploy
```

## MCP tools (200)

Tools are registered in `src/tools/core.ts`, `extended.ts`, and `remaining.ts`. Summary by area:

| Area                           | Coverage                                                                                                                                  |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Server / guild                 | list/info, edit guild, preview, vanity, widget, welcome screen, onboarding, incident actions, leave                                       |
| Members / roles                | list/get/search/edit members, roles CRUD + positions + member counts, add/remove role                                                     |
| Moderation                     | kick, ban/unban, bulk ban, list/get bans, timeout, prune, audit log                                                                       |
| Messages                       | read/send/edit/delete, search, embeds, polls (+ voters/end), pins, bulk delete, crosspost, typing, attachments, components, stickers      |
| Reactions                      | add/remove/clear, list users, remove other user’s reaction                                                                                |
| Channels                       | text/voice/announcement/forum/stage/media/category, get/edit/delete, positions, permission overwrites, voice status, follow announcements |
| Invites                        | create/list (channel+guild)/get/delete                                                                                                    |
| Threads / forums               | create (with/without message), forum posts, archive/lock/join, list active/archived, thread members                                       |
| Webhooks                       | channel/guild list, create/edit/delete, send/edit/get/delete messages, embeds                                                             |
| Emojis / stickers / soundboard | guild + application emoji CRUD, sticker CRUD, soundboard CRUD + send                                                                      |
| Events / stage                 | scheduled events CRUD + users, stage instances CRUD                                                                                       |
| Auto moderation                | rules CRUD                                                                                                                                |
| Voice                          | regions, get/modify voice states                                                                                                          |
| Templates                      | list/get/create/sync/edit/delete                                                                                                          |
| Application / commands         | app get/edit, global + guild slash command CRUD/permissions, SKUs/entitlements, role connection metadata                                  |
| Users / DMs / interactions     | get user, edit bot user, create DM, interaction response/followup helpers (token required)                                                |

Not covered (needs persistent Gateway / user OAuth / deprecated APIs): live Gateway event streams, receiving interactions without your own endpoint, OAuth user connections, creating guilds from templates via deprecated flows.

## Connect MCP clients

### MCP Inspector

```bash
pnpm dlx @modelcontextprotocol/inspector@latest
```

Connect to `http://localhost:8787/mcp`.

### Claude Desktop / Cursor (`mcp-remote`)

```json
{
	"mcpServers": {
		"discord": {
			"command": "npx",
			"args": ["mcp-remote", "https://discord-mcp-workers.<your-account>.workers.dev/mcp"]
		}
	}
}
```

Clients that support remote SSE can connect at `https://…/sse`.

## Scaffold from Cloudflare template

```bash
pnpm create cloudflare@latest my-mcp \
  --category=remote-template \
  --template=https://github.com/cloudflare/ai/tree/main/demos/remote-mcp-authless \
  --accept-defaults
```

## Security

- MCP layer is **authless** by default; restrict `/mcp` and `/sse` in production (OAuth template, Cloudflare Access, etc.).
- Never commit `.dev.vars` or bot tokens.

## License

See [LICENSE](LICENSE).

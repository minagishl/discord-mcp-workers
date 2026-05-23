# Discord MCP for Cloudflare Workers

Full Discord API access through the [Model Context Protocol (MCP)](https://modelcontextprotocol.io/), deployed on [Cloudflare Workers](https://developers.cloudflare.com/workers/). Built on Cloudflare’s official [remote-mcp-authless](https://github.com/cloudflare/ai/tree/main/demos/remote-mcp-authless) template (`McpAgent` + Durable Objects).

## Features

- **55 MCP tools** — servers, messages, channels, reactions, forums, threads, webhooks, moderation, and more
- **Server & members** — roles, emojis, member list, moderation (kick/ban/timeout), audit log
- **Messages** — read (paginated), send, edit, embeds, polls, pins, search
- **Channels** — text/voice/announcement, edit, invites, webhooks
- **Reactions, forums, threads, webhooks** — full thread lifecycle and webhook embeds

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
   - **Server Members Intent** — `discord_list_members`
4. Copy your **Application ID** from **OAuth2** → **General** (Developer Portal).
5. Invite the bot to your server — replace `YOUR_CLIENT_ID` in the URL below:

```
https://discord.com/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=1495454280919&scope=bot
```

This sets the `bot` scope and permissions used by the MCP tools (channels, messages, threads, reactions, webhooks, roles, moderation, audit log, invites). Remove permissions you do not need via the [permission calculator](https://discordapi.com/permissions.html) if you prefer a narrower invite.

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

## MCP tools (55)

### Essential

| Category   | Tools                                                                                         |
| ---------- | --------------------------------------------------------------------------------------------- |
| Server     | `discord_list_servers`, `discord_get_server_info`                                             |
| Messages   | `discord_read_messages`†, `discord_send`, `discord_delete_message`, `discord_search_messages` |
| Reactions  | `discord_add_reaction`, `discord_add_multiple_reactions`, `discord_remove_reaction`           |
| Channels   | `discord_create_text_channel`, `discord_delete_channel`                                       |
| Categories | `discord_create_category`, `discord_delete_category`                                          |
| Forums     | `discord_get_forum_channels`, `discord_create_forum_post`, `discord_reply_to_forum`           |
| Threads    | `discord_create_thread`, `discord_send_to_thread`                                             |
| Webhooks   | `discord_create_webhook`, `discord_send_webhook_message`, `discord_delete_webhook`            |

† `discord_read_messages` also supports `before`, `after`, and `around` cursors.

### Additional

| Category   | Tools                                                                                                                                                                  |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bot        | `discord_get_me`                                                                                                                                                       |
| Messages   | `discord_get_message`, `discord_edit_message`, `discord_send_embed`, `discord_create_poll`, `discord_pin_message`, `discord_unpin_message`, `discord_list_pins`        |
| Channels   | `discord_get_channel`, `discord_edit_channel`, `discord_list_webhooks`, `discord_create_voice_channel`, `discord_create_announcement_channel`, `discord_create_invite` |
| Guild      | `discord_list_roles`, `discord_list_emojis`, `discord_get_member`, `discord_list_members`, `discord_add_role`, `discord_remove_role`                                   |
| Moderation | `discord_kick_member`, `discord_ban_member`, `discord_unban_member`, `discord_timeout_member`, `discord_get_audit_log`                                                 |
| Reactions  | `discord_get_reaction_users`, `discord_clear_reactions`                                                                                                                |
| Threads    | `discord_archive_thread`, `discord_unarchive_thread`, `discord_lock_thread`, `discord_join_thread`, `discord_leave_thread`                                             |
| Webhooks   | `discord_send_webhook_embed`                                                                                                                                           |

Not implemented (REST/multipart or Gateway-heavy): file attachments, message components/buttons, slash command registration, real-time Gateway events.

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

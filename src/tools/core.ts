import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { sleep } from "../discord";
import { runTool, runToolWithArgs, type ToolEnv } from "./helpers";

export function registerCoreDiscordTools(server: McpServer, env: ToolEnv) {
	server.registerTool(
		"discord_list_servers",
		{
			description: "Lists all Discord servers the bot is a member of",
			inputSchema: {},
		},
		async () =>
			runTool(env, async (client) => client.formatServers(await client.listServers())),
	);

	server.registerTool(
		"discord_get_server_info",
		{
			description:
				"Retrieves detailed information about a Discord server including channels and member count",
			inputSchema: {
				guildId: z.string().describe("The Discord server (guild) ID"),
			},
		},
		async ({ guildId }) =>
			runToolWithArgs(env, guildId, async (client, id) => {
				const [guild, channels] = await client.getServerInfo(id);
				return client.formatServerInfo(guild, channels);
			}),
	);

	server.registerTool(
		"discord_read_messages",
		{
			description:
				"Retrieves messages from a channel (supports before/after/around pagination)",
			inputSchema: {
				channelId: z.string().describe("The channel ID to read from"),
				limit: z
					.number()
					.int()
					.min(1)
					.max(100)
					.default(50)
					.describe("Number of messages (1-100)"),
				before: z
					.string()
					.optional()
					.describe("Message ID — return messages before this ID"),
				after: z.string().optional().describe("Message ID — return messages after this ID"),
				around: z
					.string()
					.optional()
					.describe("Message ID — return messages around this ID"),
			},
		},
		async ({ channelId, limit, before, after, around }) =>
			runToolWithArgs(
				env,
				{ channelId, limit, before, after, around },
				async (client, args) => {
					const messages = await client.readMessages(args.channelId, {
						limit: args.limit,
						before: args.before,
						after: args.after,
						around: args.around,
					});
					return client.formatMessages(args.channelId, messages);
				},
			),
	);

	server.registerTool(
		"discord_send",
		{
			description: "Sends a message to a Discord text channel",
			inputSchema: {
				channelId: z.string().describe("The channel ID to send to"),
				message: z.string().describe("The message content"),
				replyToMessageId: z.string().optional().describe("Message ID to reply to"),
			},
		},
		async ({ channelId, message, replyToMessageId }) =>
			runToolWithArgs(env, { channelId, message, replyToMessageId }, async (client, args) => {
				await client.sendMessage(args.channelId, args.message, args.replyToMessageId);
				return `Message sent to channel ${args.channelId}`;
			}),
	);

	server.registerTool(
		"discord_delete_message",
		{
			description: "Deletes a message from a Discord channel",
			inputSchema: {
				channelId: z.string().describe("The channel ID"),
				messageId: z.string().describe("The message ID to delete"),
			},
		},
		async ({ channelId, messageId }) =>
			runToolWithArgs(env, { channelId, messageId }, async (client, args) => {
				await client.deleteMessage(args.channelId, args.messageId);
				return `Deleted message ${args.messageId}`;
			}),
	);

	server.registerTool(
		"discord_search_messages",
		{
			description: "Searches for messages in a Discord server",
			inputSchema: {
				guildId: z.string().describe("The server ID"),
				content: z.string().optional().describe("Text to search for"),
				authorId: z.string().optional().describe("Filter by author ID"),
				channelId: z.string().optional().describe("Filter by channel ID"),
				limit: z.number().int().default(25).describe("Max results"),
			},
		},
		async ({ guildId, content, authorId, channelId, limit }) =>
			runToolWithArgs(
				env,
				{ guildId, content, authorId, channelId, limit },
				async (client, args) =>
					client.searchMessages(args.guildId, {
						content: args.content,
						authorId: args.authorId,
						channelId: args.channelId,
						limit: args.limit,
					}),
			),
	);

	server.registerTool(
		"discord_add_reaction",
		{
			description: "Adds an emoji reaction to a message",
			inputSchema: {
				channelId: z.string().describe("The channel ID"),
				messageId: z.string().describe("The message ID"),
				emoji: z.string().describe("The emoji to react with"),
			},
		},
		async ({ channelId, messageId, emoji }) =>
			runToolWithArgs(env, { channelId, messageId, emoji }, async (client, args) => {
				await client.addReaction(args.channelId, args.messageId, args.emoji);
				return `Added ${args.emoji} to message ${args.messageId}`;
			}),
	);

	server.registerTool(
		"discord_add_multiple_reactions",
		{
			description: "Adds multiple emoji reactions to a message",
			inputSchema: {
				channelId: z.string().describe("The channel ID"),
				messageId: z.string().describe("The message ID"),
				emojis: z.array(z.string()).describe("Array of emojis"),
			},
		},
		async ({ channelId, messageId, emojis }) =>
			runToolWithArgs(env, { channelId, messageId, emojis }, async (client, args) => {
				const results: { emoji: string; success: boolean }[] = [];
				for (const emoji of args.emojis) {
					try {
						await client.addReaction(args.channelId, args.messageId, emoji);
						results.push({ emoji, success: true });
					} catch {
						results.push({ emoji, success: false });
					}
					await sleep(300);
				}
				return results;
			}),
	);

	server.registerTool(
		"discord_remove_reaction",
		{
			description: "Removes an emoji reaction from a message",
			inputSchema: {
				channelId: z.string().describe("The channel ID"),
				messageId: z.string().describe("The message ID"),
				emoji: z.string().describe("The emoji to remove"),
			},
		},
		async ({ channelId, messageId, emoji }) =>
			runToolWithArgs(env, { channelId, messageId, emoji }, async (client, args) => {
				await client.removeReaction(args.channelId, args.messageId, args.emoji);
				return `Removed ${args.emoji} from message ${args.messageId}`;
			}),
	);

	server.registerTool(
		"discord_create_text_channel",
		{
			description: "Creates a new text channel in a server",
			inputSchema: {
				guildId: z.string().describe("The server ID"),
				channelName: z.string().describe("Name for the new channel"),
				topic: z.string().optional().describe("Channel topic"),
				categoryId: z.string().optional().describe("Category to create under"),
			},
		},
		async ({ guildId, channelName, topic, categoryId }) =>
			runToolWithArgs(
				env,
				{ guildId, channelName, topic, categoryId },
				async (client, args) => {
					const result = await client.createTextChannel(args.guildId, args.channelName, {
						topic: args.topic,
						categoryId: args.categoryId,
					});
					return `Created channel "${args.channelName}" with ID: ${result.id}`;
				},
			),
	);

	server.registerTool(
		"discord_delete_channel",
		{
			description: "Deletes a Discord channel",
			inputSchema: {
				channelId: z.string().describe("The channel ID to delete"),
			},
		},
		async ({ channelId }) =>
			runToolWithArgs(env, channelId, async (client, id) => {
				await client.deleteChannel(id);
				return `Deleted channel ${id}`;
			}),
	);

	server.registerTool(
		"discord_create_category",
		{
			description: "Creates a new category in a server",
			inputSchema: {
				guildId: z.string().describe("The server ID"),
				name: z.string().describe("Category name"),
			},
		},
		async ({ guildId, name }) =>
			runToolWithArgs(env, { guildId, name }, async (client, args) => {
				const result = await client.createCategory(args.guildId, args.name);
				return `Created category "${args.name}" with ID: ${result.id}`;
			}),
	);

	server.registerTool(
		"discord_delete_category",
		{
			description: "Deletes a category",
			inputSchema: {
				categoryId: z.string().describe("The category ID to delete"),
			},
		},
		async ({ categoryId }) =>
			runToolWithArgs(env, categoryId, async (client, id) => {
				await client.deleteChannel(id);
				return `Deleted category ${id}`;
			}),
	);

	server.registerTool(
		"discord_get_forum_channels",
		{
			description: "Lists all forum channels in a server",
			inputSchema: {
				guildId: z.string().describe("The server ID"),
			},
		},
		async ({ guildId }) =>
			runToolWithArgs(env, guildId, async (client, id) => {
				const channels = await client.listGuildChannels(id);
				return client.formatForumChannels(channels);
			}),
	);

	server.registerTool(
		"discord_create_forum_post",
		{
			description: "Creates a new post in a forum channel",
			inputSchema: {
				forumChannelId: z.string().describe("The forum channel ID"),
				title: z.string().describe("Post title"),
				content: z.string().describe("Post content"),
			},
		},
		async ({ forumChannelId, title, content }) =>
			runToolWithArgs(env, { forumChannelId, title, content }, async (client, args) => {
				const result = await client.createForumPost(
					args.forumChannelId,
					args.title,
					args.content,
				);
				return `Created forum post "${args.title}" with ID: ${result.id}`;
			}),
	);

	server.registerTool(
		"discord_reply_to_forum",
		{
			description: "Adds a reply to a forum post",
			inputSchema: {
				threadId: z.string().describe("The thread ID"),
				message: z.string().describe("Reply content"),
			},
		},
		async ({ threadId, message }) =>
			runToolWithArgs(env, { threadId, message }, async (client, args) => {
				await client.replyToThread(args.threadId, args.message);
				return `Reply sent to thread ${args.threadId}`;
			}),
	);

	server.registerTool(
		"discord_create_thread",
		{
			description: "Creates a new thread from a message",
			inputSchema: {
				channelId: z.string().describe("The channel ID"),
				messageId: z.string().describe("The message ID to create thread from"),
				name: z.string().describe("Thread name"),
			},
		},
		async ({ channelId, messageId, name }) =>
			runToolWithArgs(env, { channelId, messageId, name }, async (client, args) => {
				const result = await client.createThread(args.channelId, args.messageId, args.name);
				return `Created thread "${args.name}" with ID: ${result.id}`;
			}),
	);

	server.registerTool(
		"discord_send_to_thread",
		{
			description: "Sends a message to a thread",
			inputSchema: {
				threadId: z.string().describe("The thread ID"),
				message: z.string().describe("Message content"),
			},
		},
		async ({ threadId, message }) =>
			runToolWithArgs(env, { threadId, message }, async (client, args) => {
				await client.sendMessage(args.threadId, args.message);
				return `Message sent to thread ${args.threadId}`;
			}),
	);

	server.registerTool(
		"discord_create_webhook",
		{
			description: "Creates a webhook for a channel",
			inputSchema: {
				channelId: z.string().describe("The channel ID"),
				name: z.string().describe("Webhook name"),
			},
		},
		async ({ channelId, name }) =>
			runToolWithArgs(env, { channelId, name }, async (client, args) => {
				const result = await client.createWebhook(args.channelId, args.name);
				return {
					id: result.id,
					token: result.token,
					url: `https://discord.com/api/webhooks/${result.id}/${result.token}`,
				};
			}),
	);

	server.registerTool(
		"discord_send_webhook_message",
		{
			description: "Sends a message using a webhook (custom username/avatar)",
			inputSchema: {
				webhookId: z.string().describe("Webhook ID"),
				webhookToken: z.string().describe("Webhook token"),
				content: z.string().describe("Message content"),
				username: z.string().optional().describe("Override username"),
				avatarURL: z.string().optional().describe("Override avatar URL"),
			},
		},
		async ({ webhookId, webhookToken, content, username, avatarURL }) =>
			runToolWithArgs(
				env,
				{ webhookId, webhookToken, content, username, avatarURL },
				async (client, args) => {
					await client.sendWebhookMessage(
						args.webhookId,
						args.webhookToken,
						args.content,
						{ username: args.username, avatarURL: args.avatarURL },
					);
					return "Webhook message sent";
				},
			),
	);

	server.registerTool(
		"discord_delete_webhook",
		{
			description: "Deletes a webhook",
			inputSchema: {
				webhookId: z.string().describe("Webhook ID"),
				webhookToken: z.string().optional().describe("Webhook token"),
			},
		},
		async ({ webhookId, webhookToken }) =>
			runToolWithArgs(env, { webhookId, webhookToken }, async (client, args) => {
				await client.deleteWebhook(args.webhookId, args.webhookToken);
				return `Deleted webhook ${args.webhookId}`;
			}),
	);
}

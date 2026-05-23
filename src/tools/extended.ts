import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { runTool, runToolWithArgs, type ToolEnv } from "./helpers";

const embedFieldSchema = z.object({
	name: z.string(),
	value: z.string(),
	inline: z.boolean().optional(),
});

export function registerExtendedDiscordTools(server: McpServer, env: ToolEnv) {
	// --- Bot / user ---
	server.registerTool(
		"discord_get_me",
		{
			description: "Get the authenticated bot user profile",
			inputSchema: {},
		},
		async () => runTool(env, (client) => client.getCurrentUser()),
	);

	// --- Messages (extended) ---
	server.registerTool(
		"discord_get_message",
		{
			description: "Get a single message by ID",
			inputSchema: {
				channelId: z.string(),
				messageId: z.string(),
			},
		},
		async ({ channelId, messageId }) =>
			runToolWithArgs(env, { channelId, messageId }, async (client, args) => {
				const msg = await client.getMessage(args.channelId, args.messageId);
				return client.formatMessage(msg);
			}),
	);

	server.registerTool(
		"discord_edit_message",
		{
			description: "Edit an existing message content",
			inputSchema: {
				channelId: z.string(),
				messageId: z.string(),
				content: z.string().describe("New message text"),
			},
		},
		async ({ channelId, messageId, content }) =>
			runToolWithArgs(env, { channelId, messageId, content }, async (client, args) => {
				const msg = await client.editMessage(args.channelId, args.messageId, {
					content: args.content,
				});
				return client.formatMessage(msg);
			}),
	);

	server.registerTool(
		"discord_send_embed",
		{
			description: "Send a message with a rich embed",
			inputSchema: {
				channelId: z.string(),
				title: z.string().optional(),
				description: z.string().optional(),
				url: z.string().optional(),
				color: z.number().int().optional().describe("Decimal color value"),
				fields: z.array(embedFieldSchema).optional(),
				content: z.string().optional().describe("Optional plain text above the embed"),
				replyToMessageId: z.string().optional(),
			},
		},
		async ({ channelId, title, description, url, color, fields, content, replyToMessageId }) =>
			runToolWithArgs(
				env,
				{
					channelId,
					title,
					description,
					url,
					color,
					fields,
					content,
					replyToMessageId,
				},
				async (client, args) => {
					const embed = client.buildEmbed({
						title: args.title,
						description: args.description,
						url: args.url,
						color: args.color,
						fields: args.fields,
					});
					const payload = {
						embeds: [embed],
						content: args.content,
						message_reference: args.replyToMessageId
							? { message_id: args.replyToMessageId }
							: undefined,
					};
					const msg = await client.sendMessagePayload(args.channelId, payload);
					return client.formatMessage(msg);
				},
			),
	);

	server.registerTool(
		"discord_create_poll",
		{
			description: "Create a poll in a channel (Discord native poll)",
			inputSchema: {
				channelId: z.string(),
				question: z.string(),
				answers: z.array(z.string()).min(2).max(10).describe("Poll answer options"),
				durationHours: z
					.number()
					.int()
					.min(1)
					.max(168)
					.default(24)
					.describe("Poll duration in hours"),
				allowMultiselect: z.boolean().default(false),
				content: z.string().optional().describe("Optional message text with the poll"),
			},
		},
		async ({ channelId, question, answers, durationHours, allowMultiselect, content }) =>
			runToolWithArgs(
				env,
				{ channelId, question, answers, durationHours, allowMultiselect, content },
				async (client, args) => {
					const msg = await client.sendMessagePayload(args.channelId, {
						content: args.content,
						poll: client.buildPoll(
							args.question,
							args.answers,
							args.durationHours,
							args.allowMultiselect,
						),
					});
					return client.formatMessage(msg);
				},
			),
	);

	server.registerTool(
		"discord_pin_message",
		{
			description: "Pin a message in a channel",
			inputSchema: { channelId: z.string(), messageId: z.string() },
		},
		async ({ channelId, messageId }) =>
			runToolWithArgs(env, { channelId, messageId }, async (client, args) => {
				await client.pinMessage(args.channelId, args.messageId);
				return `Pinned message ${args.messageId}`;
			}),
	);

	server.registerTool(
		"discord_unpin_message",
		{
			description: "Unpin a message in a channel",
			inputSchema: { channelId: z.string(), messageId: z.string() },
		},
		async ({ channelId, messageId }) =>
			runToolWithArgs(env, { channelId, messageId }, async (client, args) => {
				await client.unpinMessage(args.channelId, args.messageId);
				return `Unpinned message ${args.messageId}`;
			}),
	);

	server.registerTool(
		"discord_list_pins",
		{
			description: "List pinned messages in a channel",
			inputSchema: { channelId: z.string() },
		},
		async ({ channelId }) =>
			runToolWithArgs(env, channelId, async (client, id) => {
				const pins = await client.listPins(id);
				const messages = (pins.items ?? []).map((item) => {
					const msg = item.message as Record<string, unknown> | undefined;
					return msg ? client.formatMessage(msg) : item;
				});
				return { channelId: id, pins: messages };
			}),
	);

	// --- Channels (extended) ---
	server.registerTool(
		"discord_get_channel",
		{
			description: "Get channel metadata by ID",
			inputSchema: { channelId: z.string() },
		},
		async ({ channelId }) =>
			runToolWithArgs(env, channelId, (client, id) => client.getChannel(id)),
	);

	server.registerTool(
		"discord_edit_channel",
		{
			description: "Update channel settings (name, topic, slowmode, nsfw, category)",
			inputSchema: {
				channelId: z.string(),
				name: z.string().optional(),
				topic: z.string().nullable().optional(),
				nsfw: z.boolean().optional(),
				rateLimitPerUser: z
					.number()
					.int()
					.min(0)
					.max(21600)
					.optional()
					.describe("Slowmode seconds"),
				parentId: z
					.string()
					.nullable()
					.optional()
					.describe("Category ID or null to remove"),
			},
		},
		async ({ channelId, name, topic, nsfw, rateLimitPerUser, parentId }) =>
			runToolWithArgs(
				env,
				{ channelId, name, topic, nsfw, rateLimitPerUser, parentId },
				async (client, args) =>
					client.editChannel(args.channelId, {
						name: args.name,
						topic: args.topic,
						nsfw: args.nsfw,
						rate_limit_per_user: args.rateLimitPerUser,
						parent_id: args.parentId,
					}),
			),
	);

	server.registerTool(
		"discord_list_webhooks",
		{
			description: "List webhooks for a channel",
			inputSchema: { channelId: z.string() },
		},
		async ({ channelId }) =>
			runToolWithArgs(env, channelId, (client, id) => client.listWebhooks(id)),
	);

	server.registerTool(
		"discord_create_voice_channel",
		{
			description: "Create a voice channel",
			inputSchema: {
				guildId: z.string(),
				channelName: z.string(),
				categoryId: z.string().optional(),
				userLimit: z.number().int().min(0).max(99).optional(),
			},
		},
		async ({ guildId, channelName, categoryId, userLimit }) =>
			runToolWithArgs(
				env,
				{ guildId, channelName, categoryId, userLimit },
				async (client, args) => {
					const ch = await client.createVoiceChannel(args.guildId, args.channelName, {
						categoryId: args.categoryId,
						userLimit: args.userLimit,
					});
					return `Created voice channel "${args.channelName}" (ID: ${ch.id})`;
				},
			),
	);

	server.registerTool(
		"discord_create_announcement_channel",
		{
			description: "Create an announcement channel",
			inputSchema: {
				guildId: z.string(),
				channelName: z.string(),
				topic: z.string().optional(),
				categoryId: z.string().optional(),
			},
		},
		async ({ guildId, channelName, topic, categoryId }) =>
			runToolWithArgs(
				env,
				{ guildId, channelName, topic, categoryId },
				async (client, args) => {
					const ch = await client.createAnnouncementChannel(
						args.guildId,
						args.channelName,
						{ topic: args.topic, categoryId: args.categoryId },
					);
					return `Created announcement channel "${args.channelName}" (ID: ${ch.id})`;
				},
			),
	);

	server.registerTool(
		"discord_create_invite",
		{
			description: "Create an invite link for a channel",
			inputSchema: {
				channelId: z.string(),
				maxAge: z.number().int().optional().describe("Expiry in seconds (0 = never)"),
				maxUses: z.number().int().optional(),
				temporary: z.boolean().optional(),
			},
		},
		async ({ channelId, maxAge, maxUses, temporary }) =>
			runToolWithArgs(env, { channelId, maxAge, maxUses, temporary }, async (client, args) =>
				client.createInvite(args.channelId, {
					max_age: args.maxAge,
					max_uses: args.maxUses,
					temporary: args.temporary,
				}),
			),
	);

	// --- Guild members / roles ---
	server.registerTool(
		"discord_list_roles",
		{
			description: "List all roles in a server",
			inputSchema: { guildId: z.string() },
		},
		async ({ guildId }) =>
			runToolWithArgs(env, guildId, async (client, id) => {
				const roles = await client.listRoles(id);
				return client.formatRoles(roles);
			}),
	);

	server.registerTool(
		"discord_list_emojis",
		{
			description: "List custom emojis in a server",
			inputSchema: { guildId: z.string() },
		},
		async ({ guildId }) => runToolWithArgs(env, guildId, (client, id) => client.listEmojis(id)),
	);

	server.registerTool(
		"discord_get_member",
		{
			description: "Get a guild member by user ID",
			inputSchema: {
				guildId: z.string(),
				userId: z.string(),
			},
		},
		async ({ guildId, userId }) =>
			runToolWithArgs(env, { guildId, userId }, (client, args) =>
				client.getMember(args.guildId, args.userId),
			),
	);

	server.registerTool(
		"discord_list_members",
		{
			description:
				"List guild members (requires Server Members Intent; max 1000 per request)",
			inputSchema: {
				guildId: z.string(),
				limit: z.number().int().min(1).max(1000).default(100),
				after: z.string().optional().describe("User ID for pagination cursor"),
			},
		},
		async ({ guildId, limit, after }) =>
			runToolWithArgs(env, { guildId, limit, after }, async (client, args) => {
				const members = await client.listMembers(args.guildId, args.limit, args.after);
				return client.formatMembers(members);
			}),
	);

	server.registerTool(
		"discord_add_role",
		{
			description: "Add a role to a member",
			inputSchema: {
				guildId: z.string(),
				userId: z.string(),
				roleId: z.string(),
			},
		},
		async ({ guildId, userId, roleId }) =>
			runToolWithArgs(env, { guildId, userId, roleId }, async (client, args) => {
				await client.addMemberRole(args.guildId, args.userId, args.roleId);
				return `Added role ${args.roleId} to user ${args.userId}`;
			}),
	);

	server.registerTool(
		"discord_remove_role",
		{
			description: "Remove a role from a member",
			inputSchema: {
				guildId: z.string(),
				userId: z.string(),
				roleId: z.string(),
			},
		},
		async ({ guildId, userId, roleId }) =>
			runToolWithArgs(env, { guildId, userId, roleId }, async (client, args) => {
				await client.removeMemberRole(args.guildId, args.userId, args.roleId);
				return `Removed role ${args.roleId} from user ${args.userId}`;
			}),
	);

	// --- Moderation ---
	server.registerTool(
		"discord_kick_member",
		{
			description: "Kick a member from the server (requires KICK_MEMBERS)",
			inputSchema: {
				guildId: z.string(),
				userId: z.string(),
			},
		},
		async ({ guildId, userId }) =>
			runToolWithArgs(env, { guildId, userId }, async (client, args) => {
				await client.kickMember(args.guildId, args.userId);
				return `Kicked user ${args.userId}`;
			}),
	);

	server.registerTool(
		"discord_ban_member",
		{
			description: "Ban a member (requires BAN_MEMBERS)",
			inputSchema: {
				guildId: z.string(),
				userId: z.string(),
				deleteMessageDays: z
					.number()
					.int()
					.min(0)
					.max(7)
					.optional()
					.describe("Days of messages to delete"),
				reason: z.string().optional(),
			},
		},
		async ({ guildId, userId, deleteMessageDays, reason }) =>
			runToolWithArgs(
				env,
				{ guildId, userId, deleteMessageDays, reason },
				async (client, args) => {
					await client.banMember(args.guildId, args.userId, {
						deleteMessageDays: args.deleteMessageDays,
						reason: args.reason,
					});
					return `Banned user ${args.userId}`;
				},
			),
	);

	server.registerTool(
		"discord_unban_member",
		{
			description: "Remove a ban for a user ID",
			inputSchema: {
				guildId: z.string(),
				userId: z.string(),
			},
		},
		async ({ guildId, userId }) =>
			runToolWithArgs(env, { guildId, userId }, async (client, args) => {
				await client.unbanMember(args.guildId, args.userId);
				return `Unbanned user ${args.userId}`;
			}),
	);

	server.registerTool(
		"discord_timeout_member",
		{
			description:
				"Timeout (mute) a member until a Unix timestamp (ms), or remove timeout with null",
			inputSchema: {
				guildId: z.string(),
				userId: z.string(),
				until: z
					.string()
					.nullable()
					.describe(
						"ISO8601 datetime or null to remove timeout. Example: 2026-12-31T23:59:59.000Z",
					),
				reason: z.string().optional(),
			},
		},
		async ({ guildId, userId, until, reason }) =>
			runToolWithArgs(env, { guildId, userId, until, reason }, async (client, args) => {
				await client.timeoutMember(args.guildId, args.userId, args.until, args.reason);
				return args.until
					? `Timed out user ${args.userId} until ${args.until}`
					: `Removed timeout for user ${args.userId}`;
			}),
	);

	server.registerTool(
		"discord_get_audit_log",
		{
			description: "Fetch guild audit log entries (requires VIEW_AUDIT_LOG)",
			inputSchema: {
				guildId: z.string(),
				limit: z.number().int().min(1).max(100).default(25),
				userId: z.string().optional(),
				actionType: z.number().int().optional().describe("Audit log action type filter"),
				before: z.string().optional().describe("Entry ID pagination cursor"),
			},
		},
		async ({ guildId, limit, userId, actionType, before }) =>
			runToolWithArgs(
				env,
				{ guildId, limit, userId, actionType, before },
				async (client, args) =>
					client.getAuditLog(args.guildId, {
						limit: args.limit,
						userId: args.userId,
						actionType: args.actionType,
						before: args.before,
					}),
			),
	);

	// --- Reactions (extended) ---
	server.registerTool(
		"discord_get_reaction_users",
		{
			description: "List users who reacted with a specific emoji",
			inputSchema: {
				channelId: z.string(),
				messageId: z.string(),
				emoji: z.string(),
				limit: z.number().int().min(1).max(100).default(25),
				after: z.string().optional(),
			},
		},
		async ({ channelId, messageId, emoji, limit, after }) =>
			runToolWithArgs(
				env,
				{ channelId, messageId, emoji, limit, after },
				async (client, args) =>
					client.getReactionUsers(
						args.channelId,
						args.messageId,
						args.emoji,
						args.limit,
						args.after,
					),
			),
	);

	server.registerTool(
		"discord_clear_reactions",
		{
			description: "Remove all reactions from a message, or only one emoji if specified",
			inputSchema: {
				channelId: z.string(),
				messageId: z.string(),
				emoji: z.string().optional(),
			},
		},
		async ({ channelId, messageId, emoji }) =>
			runToolWithArgs(env, { channelId, messageId, emoji }, async (client, args) => {
				await client.clearReactions(args.channelId, args.messageId, args.emoji);
				return args.emoji
					? `Cleared ${args.emoji} reactions on ${args.messageId}`
					: `Cleared all reactions on ${args.messageId}`;
			}),
	);

	// --- Threads (extended) ---
	server.registerTool(
		"discord_archive_thread",
		{
			description: "Archive a thread",
			inputSchema: { threadId: z.string() },
		},
		async ({ threadId }) =>
			runToolWithArgs(env, threadId, async (client, id) => {
				await client.editThread(id, { archived: true });
				return `Archived thread ${id}`;
			}),
	);

	server.registerTool(
		"discord_unarchive_thread",
		{
			description: "Unarchive a thread",
			inputSchema: { threadId: z.string() },
		},
		async ({ threadId }) =>
			runToolWithArgs(env, threadId, async (client, id) => {
				await client.editThread(id, { archived: false });
				return `Unarchived thread ${id}`;
			}),
	);

	server.registerTool(
		"discord_lock_thread",
		{
			description: "Lock a thread (prevent new messages from non-mods)",
			inputSchema: { threadId: z.string() },
		},
		async ({ threadId }) =>
			runToolWithArgs(env, threadId, async (client, id) => {
				await client.editThread(id, { locked: true });
				return `Locked thread ${id}`;
			}),
	);

	server.registerTool(
		"discord_join_thread",
		{
			description: "Join a thread as the bot",
			inputSchema: { threadId: z.string() },
		},
		async ({ threadId }) =>
			runToolWithArgs(env, threadId, async (client, id) => {
				await client.joinThread(id);
				return `Joined thread ${id}`;
			}),
	);

	server.registerTool(
		"discord_leave_thread",
		{
			description: "Leave a thread as the bot",
			inputSchema: { threadId: z.string() },
		},
		async ({ threadId }) =>
			runToolWithArgs(env, threadId, async (client, id) => {
				await client.leaveThread(id);
				return `Left thread ${id}`;
			}),
	);

	// --- Webhook embed ---
	server.registerTool(
		"discord_send_webhook_embed",
		{
			description: "Send a webhook message with an embed",
			inputSchema: {
				webhookId: z.string(),
				webhookToken: z.string(),
				title: z.string().optional(),
				description: z.string().optional(),
				url: z.string().optional(),
				color: z.number().int().optional(),
				content: z.string().optional(),
				username: z.string().optional(),
				avatarURL: z.string().optional(),
			},
		},
		async ({
			webhookId,
			webhookToken,
			title,
			description,
			url,
			color,
			content,
			username,
			avatarURL,
		}) =>
			runToolWithArgs(
				env,
				{
					webhookId,
					webhookToken,
					title,
					description,
					url,
					color,
					content,
					username,
					avatarURL,
				},
				async (client, args) => {
					const embed = client.buildEmbed({
						title: args.title,
						description: args.description,
						url: args.url,
						color: args.color,
					});
					await client.sendWebhookMessage(
						args.webhookId,
						args.webhookToken,
						args.content ?? "",
						{
							username: args.username,
							avatarURL: args.avatarURL,
							embeds: [embed],
						},
					);
					return "Webhook embed sent";
				},
			),
	);
}

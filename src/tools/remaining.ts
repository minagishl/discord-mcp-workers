import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { errorToolResult, jsonToolResult, resolveDiscordToken, textToolResult } from "../discord";
import { DiscordClientExtra } from "../discord-extra";
import type { ToolEnv } from "./helpers";

function clientFrom(env: ToolEnv): DiscordClientExtra {
	const token = resolveDiscordToken(env);
	if (!token) {
		throw new Error(
			"Discord bot token is not configured. Set DISCORD_BOT_TOKEN (or DISCORD_TOKEN) via `wrangler secret put` or in .dev.vars for local development.",
		);
	}
	return new DiscordClientExtra(token);
}

async function run(
	env: ToolEnv,
	handler: (client: DiscordClientExtra) => Promise<string | unknown>,
) {
	try {
		const result = await handler(clientFrom(env));
		if (typeof result === "string") return textToolResult(result);
		return jsonToolResult(result);
	} catch (error) {
		return errorToolResult(error);
	}
}

async function runArgs<T>(
	env: ToolEnv,
	args: T,
	handler: (client: DiscordClientExtra, args: T) => Promise<string | unknown>,
) {
	try {
		const result = await handler(clientFrom(env), args);
		if (typeof result === "string") return textToolResult(result);
		return jsonToolResult(result);
	} catch (error) {
		return errorToolResult(error);
	}
}

export function registerRemainingDiscordTools(server: McpServer, env: ToolEnv) {
	const jsonObject = z.record(z.string(), z.unknown());
	const jsonArray = z.array(z.unknown());

	// --- Messages / channels ---
	server.registerTool(
		"discord_bulk_delete_messages",
		{
			description: "Bulk delete 2-100 messages (messages must be <14 days old)",
			inputSchema: {
				channelId: z.string(),
				messageIds: z.array(z.string()).min(2).max(100),
			},
		},
		async ({ channelId, messageIds }) =>
			runArgs(env, { channelId, messageIds }, async (client, args) => {
				await client.bulkDeleteMessages(args.channelId, args.messageIds);
				return `Bulk deleted ${args.messageIds.length} messages`;
			}),
	);

	server.registerTool(
		"discord_crosspost_message",
		{
			description: "Crosspost an announcement channel message",
			inputSchema: { channelId: z.string(), messageId: z.string() },
		},
		async ({ channelId, messageId }) =>
			runArgs(env, { channelId, messageId }, (client, args) =>
				client.crosspostMessage(args.channelId, args.messageId),
			),
	);

	server.registerTool(
		"discord_remove_user_reaction",
		{
			description: "Remove a specific user's reaction from a message",
			inputSchema: {
				channelId: z.string(),
				messageId: z.string(),
				emoji: z.string(),
				userId: z.string(),
			},
		},
		async ({ channelId, messageId, emoji, userId }) =>
			runArgs(env, { channelId, messageId, emoji, userId }, async (client, args) => {
				await client.removeUserReaction(
					args.channelId,
					args.messageId,
					args.emoji,
					args.userId,
				);
				return `Removed ${args.emoji} reaction by ${args.userId}`;
			}),
	);

	server.registerTool(
		"discord_trigger_typing",
		{
			description: "Show the bot as typing in a channel",
			inputSchema: { channelId: z.string() },
		},
		async ({ channelId }) =>
			runArgs(env, channelId, async (client, id) => {
				await client.triggerTyping(id);
				return `Typing indicator sent in ${id}`;
			}),
	);

	server.registerTool(
		"discord_follow_announcement_channel",
		{
			description: "Follow an announcement channel into another channel",
			inputSchema: {
				channelId: z.string().describe("Announcement channel to follow"),
				webhookChannelId: z.string().describe("Target channel for posts"),
			},
		},
		async ({ channelId, webhookChannelId }) =>
			runArgs(env, { channelId, webhookChannelId }, (client, args) =>
				client.followAnnouncementChannel(args.channelId, args.webhookChannelId),
			),
	);

	server.registerTool(
		"discord_list_channel_invites",
		{
			description: "List invites for a channel",
			inputSchema: { channelId: z.string() },
		},
		async ({ channelId }) =>
			runArgs(env, channelId, (client, id) => client.listChannelInvites(id)),
	);

	server.registerTool(
		"discord_modify_channel_positions",
		{
			description: "Batch update channel positions / parents in a guild",
			inputSchema: {
				guildId: z.string(),
				positions: z.array(
					z.object({
						id: z.string(),
						position: z.number().int().nullable().optional(),
						parentId: z.string().nullable().optional(),
						lockPermissions: z.boolean().optional(),
					}),
				),
			},
		},
		async ({ guildId, positions }) =>
			runArgs(env, { guildId, positions }, async (client, args) => {
				await client.modifyChannelPositions(
					args.guildId,
					args.positions.map((p) => ({
						id: p.id,
						position: p.position,
						parent_id: p.parentId,
						lock_permissions: p.lockPermissions,
					})),
				);
				return `Updated ${args.positions.length} channel positions`;
			}),
	);

	server.registerTool(
		"discord_set_voice_status",
		{
			description: "Set voice channel status text (or null to clear)",
			inputSchema: {
				channelId: z.string(),
				status: z.string().nullable(),
			},
		},
		async ({ channelId, status }) =>
			runArgs(env, { channelId, status }, async (client, args) => {
				await client.setVoiceStatus(args.channelId, args.status);
				return `Voice status updated for ${args.channelId}`;
			}),
	);

	server.registerTool(
		"discord_create_forum_channel",
		{
			description: "Create a forum channel",
			inputSchema: {
				guildId: z.string(),
				channelName: z.string(),
				topic: z.string().optional(),
				categoryId: z.string().optional(),
			},
		},
		async ({ guildId, channelName, topic, categoryId }) =>
			runArgs(env, { guildId, channelName, topic, categoryId }, async (client, args) => {
				const ch = await client.createForumChannel(args.guildId, args.channelName, {
					topic: args.topic,
					categoryId: args.categoryId,
				});
				return `Created forum channel "${args.channelName}" (ID: ${ch.id})`;
			}),
	);

	server.registerTool(
		"discord_create_stage_channel",
		{
			description: "Create a stage channel",
			inputSchema: {
				guildId: z.string(),
				channelName: z.string(),
				categoryId: z.string().optional(),
			},
		},
		async ({ guildId, channelName, categoryId }) =>
			runArgs(env, { guildId, channelName, categoryId }, async (client, args) => {
				const ch = await client.createStageChannel(args.guildId, args.channelName, {
					categoryId: args.categoryId,
				});
				return `Created stage channel "${args.channelName}" (ID: ${ch.id})`;
			}),
	);

	server.registerTool(
		"discord_create_media_channel",
		{
			description: "Create a media channel",
			inputSchema: {
				guildId: z.string(),
				channelName: z.string(),
				topic: z.string().optional(),
				categoryId: z.string().optional(),
			},
		},
		async ({ guildId, channelName, topic, categoryId }) =>
			runArgs(env, { guildId, channelName, topic, categoryId }, async (client, args) => {
				const ch = await client.createMediaChannel(args.guildId, args.channelName, {
					topic: args.topic,
					categoryId: args.categoryId,
				});
				return `Created media channel "${args.channelName}" (ID: ${ch.id})`;
			}),
	);

	server.registerTool(
		"discord_send_components",
		{
			description:
				"Send a message with components (buttons/selects). Interaction handling requires Gateway.",
			inputSchema: {
				channelId: z.string(),
				content: z.string().optional(),
				components: jsonArray.describe("Discord component rows JSON"),
				embeds: jsonArray.optional(),
				replyToMessageId: z.string().optional(),
			},
		},
		async ({ channelId, content, components, embeds, replyToMessageId }) =>
			runArgs(
				env,
				{ channelId, content, components, embeds, replyToMessageId },
				(client, args) =>
					client.sendMessageWithComponents(args.channelId, {
						content: args.content,
						components: args.components as Record<string, unknown>[],
						embeds: args.embeds as Record<string, unknown>[] | undefined,
						replyToMessageId: args.replyToMessageId,
					}),
			),
	);

	server.registerTool(
		"discord_send_stickers",
		{
			description: "Send sticker(s) to a channel",
			inputSchema: {
				channelId: z.string(),
				stickerIds: z.array(z.string()).min(1).max(3),
				content: z.string().optional(),
			},
		},
		async ({ channelId, stickerIds, content }) =>
			runArgs(env, { channelId, stickerIds, content }, (client, args) =>
				client.sendStickers(args.channelId, args.stickerIds, args.content),
			),
	);

	server.registerTool(
		"discord_send_attachment",
		{
			description: "Send a file attachment from base64 data",
			inputSchema: {
				channelId: z.string(),
				filename: z.string(),
				base64Data: z.string().describe("Raw base64 or data URI"),
				contentType: z.string().optional(),
				content: z.string().optional(),
			},
		},
		async ({ channelId, filename, base64Data, contentType, content }) =>
			runArgs(
				env,
				{ channelId, filename, base64Data, contentType, content },
				(client, args) =>
					client.sendAttachment(args.channelId, {
						filename: args.filename,
						base64Data: args.base64Data,
						contentType: args.contentType,
						content: args.content,
					}),
			),
	);

	// --- Invites ---
	server.registerTool(
		"discord_get_invite",
		{
			description: "Get invite metadata by code",
			inputSchema: {
				code: z.string(),
				withCounts: z.boolean().default(true),
				withExpiration: z.boolean().default(true),
			},
		},
		async ({ code, withCounts, withExpiration }) =>
			runArgs(env, { code, withCounts, withExpiration }, (client, args) =>
				client.getInvite(args.code, args.withCounts, args.withExpiration),
			),
	);

	server.registerTool(
		"discord_delete_invite",
		{
			description: "Delete an invite by code",
			inputSchema: { code: z.string() },
		},
		async ({ code }) =>
			runArgs(env, code, async (client, inviteCode) => {
				await client.deleteInvite(inviteCode);
				return `Deleted invite ${inviteCode}`;
			}),
	);

	server.registerTool(
		"discord_list_guild_invites",
		{
			description: "List all invites in a guild",
			inputSchema: { guildId: z.string() },
		},
		async ({ guildId }) => runArgs(env, guildId, (client, id) => client.listGuildInvites(id)),
	);

	// --- Threads ---
	server.registerTool(
		"discord_create_thread_without_message",
		{
			description: "Create a thread not attached to a message",
			inputSchema: {
				channelId: z.string(),
				name: z.string(),
				autoArchiveDuration: z.number().int().optional(),
				type: z.number().int().optional().describe("10 public, 11 private, 12 news"),
				invitable: z.boolean().optional(),
				rateLimitPerUser: z.number().int().optional(),
			},
		},
		async ({ channelId, name, autoArchiveDuration, type, invitable, rateLimitPerUser }) =>
			runArgs(
				env,
				{ channelId, name, autoArchiveDuration, type, invitable, rateLimitPerUser },
				(client, args) =>
					client.createThreadWithoutMessage(args.channelId, {
						name: args.name,
						autoArchiveDuration: args.autoArchiveDuration,
						type: args.type,
						invitable: args.invitable,
						rateLimitPerUser: args.rateLimitPerUser,
					}),
			),
	);

	server.registerTool(
		"discord_list_active_threads",
		{
			description: "List active threads in a guild",
			inputSchema: { guildId: z.string() },
		},
		async ({ guildId }) => runArgs(env, guildId, (client, id) => client.listActiveThreads(id)),
	);

	server.registerTool(
		"discord_list_archived_public_threads",
		{
			description: "List archived public threads in a channel",
			inputSchema: {
				channelId: z.string(),
				before: z.string().optional(),
				limit: z.number().int().optional(),
			},
		},
		async ({ channelId, before, limit }) =>
			runArgs(env, { channelId, before, limit }, (client, args) =>
				client.listArchivedThreads(args.channelId, "public", {
					before: args.before,
					limit: args.limit,
				}),
			),
	);

	server.registerTool(
		"discord_list_archived_private_threads",
		{
			description: "List archived private threads in a channel",
			inputSchema: {
				channelId: z.string(),
				before: z.string().optional(),
				limit: z.number().int().optional(),
			},
		},
		async ({ channelId, before, limit }) =>
			runArgs(env, { channelId, before, limit }, (client, args) =>
				client.listArchivedThreads(args.channelId, "private", {
					before: args.before,
					limit: args.limit,
				}),
			),
	);

	server.registerTool(
		"discord_list_joined_private_archived_threads",
		{
			description: "List private archived threads the bot has joined",
			inputSchema: {
				channelId: z.string(),
				before: z.string().optional(),
				limit: z.number().int().optional(),
			},
		},
		async ({ channelId, before, limit }) =>
			runArgs(env, { channelId, before, limit }, (client, args) =>
				client.listJoinedPrivateArchivedThreads(args.channelId, {
					before: args.before,
					limit: args.limit,
				}),
			),
	);

	server.registerTool(
		"discord_list_thread_members",
		{
			description: "List members of a thread",
			inputSchema: {
				threadId: z.string(),
				after: z.string().optional(),
				limit: z.number().int().optional(),
			},
		},
		async ({ threadId, after, limit }) =>
			runArgs(env, { threadId, after, limit }, (client, args) =>
				client.listThreadMembers(args.threadId, { after: args.after, limit: args.limit }),
			),
	);

	server.registerTool(
		"discord_get_thread_member",
		{
			description: "Get a thread member",
			inputSchema: { threadId: z.string(), userId: z.string() },
		},
		async ({ threadId, userId }) =>
			runArgs(env, { threadId, userId }, (client, args) =>
				client.getThreadMember(args.threadId, args.userId),
			),
	);

	server.registerTool(
		"discord_add_thread_member",
		{
			description: "Add a user to a thread",
			inputSchema: { threadId: z.string(), userId: z.string() },
		},
		async ({ threadId, userId }) =>
			runArgs(env, { threadId, userId }, async (client, args) => {
				await client.addThreadMember(args.threadId, args.userId);
				return `Added ${args.userId} to thread ${args.threadId}`;
			}),
	);

	server.registerTool(
		"discord_remove_thread_member",
		{
			description: "Remove a user from a thread",
			inputSchema: { threadId: z.string(), userId: z.string() },
		},
		async ({ threadId, userId }) =>
			runArgs(env, { threadId, userId }, async (client, args) => {
				await client.removeThreadMember(args.threadId, args.userId);
				return `Removed ${args.userId} from thread ${args.threadId}`;
			}),
	);

	// --- Guild ---
	server.registerTool(
		"discord_edit_guild",
		{
			description: "Edit guild settings (pass Discord guild PATCH JSON fields)",
			inputSchema: {
				guildId: z.string(),
				body: jsonObject.describe("Guild modify payload"),
			},
		},
		async ({ guildId, body }) =>
			runArgs(env, { guildId, body }, (client, args) =>
				client.editGuild(args.guildId, args.body),
			),
	);

	server.registerTool(
		"discord_get_guild_preview",
		{
			description: "Get a guild preview",
			inputSchema: { guildId: z.string() },
		},
		async ({ guildId }) => runArgs(env, guildId, (client, id) => client.getGuildPreview(id)),
	);

	server.registerTool(
		"discord_get_role",
		{
			description: "Get a single role",
			inputSchema: { guildId: z.string(), roleId: z.string() },
		},
		async ({ guildId, roleId }) =>
			runArgs(env, { guildId, roleId }, (client, args) =>
				client.getRole(args.guildId, args.roleId),
			),
	);

	server.registerTool(
		"discord_modify_role_positions",
		{
			description: "Batch update role positions",
			inputSchema: {
				guildId: z.string(),
				positions: z.array(
					z.object({
						id: z.string(),
						position: z.number().int().nullable().optional(),
					}),
				),
			},
		},
		async ({ guildId, positions }) =>
			runArgs(env, { guildId, positions }, (client, args) =>
				client.modifyRolePositions(args.guildId, args.positions),
			),
	);

	server.registerTool(
		"discord_get_role_member_counts",
		{
			description: "Get member counts per role",
			inputSchema: { guildId: z.string() },
		},
		async ({ guildId }) =>
			runArgs(env, guildId, (client, id) => client.getRoleMemberCounts(id)),
	);

	server.registerTool(
		"discord_edit_member",
		{
			description: "Edit a guild member (nick, roles, mute, deaf, channel, timeout, flags)",
			inputSchema: {
				guildId: z.string(),
				userId: z.string(),
				body: jsonObject,
			},
		},
		async ({ guildId, userId, body }) =>
			runArgs(env, { guildId, userId, body }, (client, args) =>
				client.editMember(args.guildId, args.userId, args.body),
			),
	);

	server.registerTool(
		"discord_edit_bot_member",
		{
			description: "Edit the bot's guild member profile (nick)",
			inputSchema: {
				guildId: z.string(),
				body: jsonObject,
			},
		},
		async ({ guildId, body }) =>
			runArgs(env, { guildId, body }, (client, args) =>
				client.editCurrentMember(args.guildId, args.body),
			),
	);

	server.registerTool(
		"discord_search_members",
		{
			description: "Search guild members by username/nickname query",
			inputSchema: {
				guildId: z.string(),
				query: z.string(),
				limit: z.number().int().min(1).max(1000).default(1),
			},
		},
		async ({ guildId, query, limit }) =>
			runArgs(env, { guildId, query, limit }, (client, args) =>
				client.searchMembers(args.guildId, args.query, args.limit),
			),
	);

	server.registerTool(
		"discord_list_bans",
		{
			description: "List guild bans",
			inputSchema: {
				guildId: z.string(),
				limit: z.number().int().optional(),
				before: z.string().optional(),
				after: z.string().optional(),
			},
		},
		async ({ guildId, limit, before, after }) =>
			runArgs(env, { guildId, limit, before, after }, (client, args) =>
				client.listBans(args.guildId, {
					limit: args.limit,
					before: args.before,
					after: args.after,
				}),
			),
	);

	server.registerTool(
		"discord_get_ban",
		{
			description: "Get a ban for a user",
			inputSchema: { guildId: z.string(), userId: z.string() },
		},
		async ({ guildId, userId }) =>
			runArgs(env, { guildId, userId }, (client, args) =>
				client.getBan(args.guildId, args.userId),
			),
	);

	server.registerTool(
		"discord_bulk_ban",
		{
			description: "Ban multiple users at once (max 200)",
			inputSchema: {
				guildId: z.string(),
				userIds: z.array(z.string()).min(1).max(200),
				deleteMessageSeconds: z.number().int().min(0).max(604800).optional(),
			},
		},
		async ({ guildId, userIds, deleteMessageSeconds }) =>
			runArgs(env, { guildId, userIds, deleteMessageSeconds }, (client, args) =>
				client.bulkBan(args.guildId, args.userIds, {
					deleteMessageSeconds: args.deleteMessageSeconds,
				}),
			),
	);

	server.registerTool(
		"discord_get_prune_count",
		{
			description: "Preview prune count",
			inputSchema: {
				guildId: z.string(),
				days: z.number().int().min(1).max(30).optional(),
				includeRoles: z.array(z.string()).optional(),
			},
		},
		async ({ guildId, days, includeRoles }) =>
			runArgs(env, { guildId, days, includeRoles }, (client, args) =>
				client.getPruneCount(args.guildId, {
					days: args.days,
					includeRoles: args.includeRoles,
				}),
			),
	);

	server.registerTool(
		"discord_begin_prune",
		{
			description: "Begin pruning inactive members",
			inputSchema: {
				guildId: z.string(),
				days: z.number().int().min(1).max(30).optional(),
				computePruneCount: z.boolean().optional(),
				includeRoles: z.array(z.string()).optional(),
				reason: z.string().optional(),
			},
		},
		async ({ guildId, days, computePruneCount, includeRoles, reason }) =>
			runArgs(
				env,
				{ guildId, days, computePruneCount, includeRoles, reason },
				(client, args) =>
					client.beginPrune(args.guildId, {
						days: args.days,
						computePruneCount: args.computePruneCount,
						includeRoles: args.includeRoles,
						reason: args.reason,
					}),
			),
	);

	server.registerTool(
		"discord_list_guild_voice_regions",
		{
			description: "List voice regions available to a guild",
			inputSchema: { guildId: z.string() },
		},
		async ({ guildId }) =>
			runArgs(env, guildId, (client, id) => client.listGuildVoiceRegions(id)),
	);

	server.registerTool(
		"discord_list_integrations",
		{
			description: "List guild integrations",
			inputSchema: { guildId: z.string() },
		},
		async ({ guildId }) => runArgs(env, guildId, (client, id) => client.listIntegrations(id)),
	);

	server.registerTool(
		"discord_delete_integration",
		{
			description: "Delete a guild integration",
			inputSchema: { guildId: z.string(), integrationId: z.string() },
		},
		async ({ guildId, integrationId }) =>
			runArgs(env, { guildId, integrationId }, async (client, args) => {
				await client.deleteIntegration(args.guildId, args.integrationId);
				return `Deleted integration ${args.integrationId}`;
			}),
	);

	server.registerTool(
		"discord_get_vanity_url",
		{
			description: "Get guild vanity URL",
			inputSchema: { guildId: z.string() },
		},
		async ({ guildId }) => runArgs(env, guildId, (client, id) => client.getVanityUrl(id)),
	);

	server.registerTool(
		"discord_get_widget_settings",
		{
			description: "Get guild widget settings",
			inputSchema: { guildId: z.string() },
		},
		async ({ guildId }) => runArgs(env, guildId, (client, id) => client.getWidgetSettings(id)),
	);

	server.registerTool(
		"discord_edit_widget_settings",
		{
			description: "Edit guild widget settings",
			inputSchema: { guildId: z.string(), body: jsonObject },
		},
		async ({ guildId, body }) =>
			runArgs(env, { guildId, body }, (client, args) =>
				client.editWidgetSettings(args.guildId, args.body),
			),
	);

	server.registerTool(
		"discord_get_widget_json",
		{
			description: "Get guild widget JSON",
			inputSchema: { guildId: z.string() },
		},
		async ({ guildId }) => runArgs(env, guildId, (client, id) => client.getWidgetJson(id)),
	);

	server.registerTool(
		"discord_get_welcome_screen",
		{
			description: "Get guild welcome screen",
			inputSchema: { guildId: z.string() },
		},
		async ({ guildId }) => runArgs(env, guildId, (client, id) => client.getWelcomeScreen(id)),
	);

	server.registerTool(
		"discord_edit_welcome_screen",
		{
			description: "Edit guild welcome screen",
			inputSchema: { guildId: z.string(), body: jsonObject },
		},
		async ({ guildId, body }) =>
			runArgs(env, { guildId, body }, (client, args) =>
				client.editWelcomeScreen(args.guildId, args.body),
			),
	);

	server.registerTool(
		"discord_get_onboarding",
		{
			description: "Get guild onboarding",
			inputSchema: { guildId: z.string() },
		},
		async ({ guildId }) => runArgs(env, guildId, (client, id) => client.getOnboarding(id)),
	);

	server.registerTool(
		"discord_edit_onboarding",
		{
			description: "Edit guild onboarding",
			inputSchema: { guildId: z.string(), body: jsonObject },
		},
		async ({ guildId, body }) =>
			runArgs(env, { guildId, body }, (client, args) =>
				client.editOnboarding(args.guildId, args.body),
			),
	);

	server.registerTool(
		"discord_set_incident_actions",
		{
			description: "Enable/disable incident actions (invites/DMs disabled until)",
			inputSchema: { guildId: z.string(), body: jsonObject },
		},
		async ({ guildId, body }) =>
			runArgs(env, { guildId, body }, (client, args) =>
				client.setIncidentActions(args.guildId, args.body),
			),
	);

	server.registerTool(
		"discord_leave_guild",
		{
			description: "Make the bot leave a guild",
			inputSchema: { guildId: z.string() },
		},
		async ({ guildId }) =>
			runArgs(env, guildId, async (client, id) => {
				await client.leaveGuild(id);
				return `Left guild ${id}`;
			}),
	);

	registerEmojiStickerSoundTools(server, env, run, runArgs);
	registerEventsStageAutomodPollVoiceTools(server, env, run, runArgs, jsonObject);
	registerWebhookTemplateAppUserTools(server, env, run, runArgs, jsonObject, jsonArray);
}

type RunFn = (
	env: ToolEnv,
	handler: (client: DiscordClientExtra) => Promise<string | unknown>,
) => Promise<ReturnType<typeof textToolResult> | ReturnType<typeof errorToolResult>>;

type RunArgs = <T>(
	env: ToolEnv,
	args: T,
	handler: (client: DiscordClientExtra, args: T) => Promise<string | unknown>,
) => Promise<ReturnType<typeof textToolResult> | ReturnType<typeof errorToolResult>>;

function registerEmojiStickerSoundTools(
	server: McpServer,
	env: ToolEnv,
	run: RunFn,
	runArgs: RunArgs,
) {
	server.registerTool(
		"discord_get_emoji",
		{
			description: "Get a guild emoji",
			inputSchema: { guildId: z.string(), emojiId: z.string() },
		},
		async ({ guildId, emojiId }) =>
			runArgs(env, { guildId, emojiId }, (client, args) =>
				client.getEmoji(args.guildId, args.emojiId),
			),
	);

	server.registerTool(
		"discord_create_emoji",
		{
			description: "Create a guild emoji (image as data URI)",
			inputSchema: {
				guildId: z.string(),
				name: z.string(),
				imageDataUri: z.string().describe("data:image/png;base64,..."),
				roles: z.array(z.string()).optional(),
			},
		},
		async ({ guildId, name, imageDataUri, roles }) =>
			runArgs(env, { guildId, name, imageDataUri, roles }, (client, args) =>
				client.createEmoji(args.guildId, {
					name: args.name,
					imageDataUri: args.imageDataUri,
					roles: args.roles,
				}),
			),
	);

	server.registerTool(
		"discord_edit_emoji",
		{
			description: "Edit a guild emoji",
			inputSchema: {
				guildId: z.string(),
				emojiId: z.string(),
				name: z.string().optional(),
				roles: z.array(z.string()).nullable().optional(),
			},
		},
		async ({ guildId, emojiId, name, roles }) =>
			runArgs(env, { guildId, emojiId, name, roles }, (client, args) =>
				client.editEmoji(args.guildId, args.emojiId, {
					name: args.name,
					roles: args.roles,
				}),
			),
	);

	server.registerTool(
		"discord_delete_emoji",
		{
			description: "Delete a guild emoji",
			inputSchema: { guildId: z.string(), emojiId: z.string() },
		},
		async ({ guildId, emojiId }) =>
			runArgs(env, { guildId, emojiId }, async (client, args) => {
				await client.deleteEmoji(args.guildId, args.emojiId);
				return `Deleted emoji ${args.emojiId}`;
			}),
	);

	server.registerTool(
		"discord_list_stickers",
		{
			description: "List guild stickers",
			inputSchema: { guildId: z.string() },
		},
		async ({ guildId }) => runArgs(env, guildId, (client, id) => client.listGuildStickers(id)),
	);

	server.registerTool(
		"discord_get_sticker",
		{
			description: "Get a sticker by ID",
			inputSchema: { stickerId: z.string() },
		},
		async ({ stickerId }) => runArgs(env, stickerId, (client, id) => client.getSticker(id)),
	);

	server.registerTool(
		"discord_list_sticker_packs",
		{
			description: "List Nitro sticker packs",
			inputSchema: {},
		},
		async () => run(env, (client) => client.listStickerPacks()),
	);

	server.registerTool(
		"discord_create_sticker",
		{
			description: "Create a guild sticker from base64 file data",
			inputSchema: {
				guildId: z.string(),
				name: z.string(),
				description: z.string(),
				tags: z.string(),
				filename: z.string(),
				base64Data: z.string(),
				contentType: z.string().optional(),
			},
		},
		async ({ guildId, name, description, tags, filename, base64Data, contentType }) =>
			runArgs(
				env,
				{ guildId, name, description, tags, filename, base64Data, contentType },
				(client, args) =>
					client.createSticker(args.guildId, {
						name: args.name,
						description: args.description,
						tags: args.tags,
						filename: args.filename,
						base64Data: args.base64Data,
						contentType: args.contentType,
					}),
			),
	);

	server.registerTool(
		"discord_edit_sticker",
		{
			description: "Edit a guild sticker",
			inputSchema: {
				guildId: z.string(),
				stickerId: z.string(),
				name: z.string().optional(),
				description: z.string().nullable().optional(),
				tags: z.string().optional(),
			},
		},
		async ({ guildId, stickerId, name, description, tags }) =>
			runArgs(env, { guildId, stickerId, name, description, tags }, (client, args) =>
				client.editSticker(args.guildId, args.stickerId, {
					name: args.name,
					description: args.description,
					tags: args.tags,
				}),
			),
	);

	server.registerTool(
		"discord_delete_sticker",
		{
			description: "Delete a guild sticker",
			inputSchema: { guildId: z.string(), stickerId: z.string() },
		},
		async ({ guildId, stickerId }) =>
			runArgs(env, { guildId, stickerId }, async (client, args) => {
				await client.deleteSticker(args.guildId, args.stickerId);
				return `Deleted sticker ${args.stickerId}`;
			}),
	);

	server.registerTool(
		"discord_list_default_soundboard_sounds",
		{
			description: "List default soundboard sounds",
			inputSchema: {},
		},
		async () => run(env, (client) => client.listDefaultSoundboardSounds()),
	);

	server.registerTool(
		"discord_list_guild_soundboard_sounds",
		{
			description: "List guild soundboard sounds",
			inputSchema: { guildId: z.string() },
		},
		async ({ guildId }) =>
			runArgs(env, guildId, (client, id) => client.listGuildSoundboardSounds(id)),
	);

	server.registerTool(
		"discord_get_guild_soundboard_sound",
		{
			description: "Get a guild soundboard sound",
			inputSchema: { guildId: z.string(), soundId: z.string() },
		},
		async ({ guildId, soundId }) =>
			runArgs(env, { guildId, soundId }, (client, args) =>
				client.getGuildSoundboardSound(args.guildId, args.soundId),
			),
	);

	server.registerTool(
		"discord_create_guild_soundboard_sound",
		{
			description: "Create a guild soundboard sound (JSON body per Discord docs)",
			inputSchema: { guildId: z.string(), body: z.record(z.string(), z.unknown()) },
		},
		async ({ guildId, body }) =>
			runArgs(env, { guildId, body }, (client, args) =>
				client.createGuildSoundboardSound(args.guildId, args.body),
			),
	);

	server.registerTool(
		"discord_edit_guild_soundboard_sound",
		{
			description: "Edit a guild soundboard sound",
			inputSchema: {
				guildId: z.string(),
				soundId: z.string(),
				body: z.record(z.string(), z.unknown()),
			},
		},
		async ({ guildId, soundId, body }) =>
			runArgs(env, { guildId, soundId, body }, (client, args) =>
				client.editGuildSoundboardSound(args.guildId, args.soundId, args.body),
			),
	);

	server.registerTool(
		"discord_delete_guild_soundboard_sound",
		{
			description: "Delete a guild soundboard sound",
			inputSchema: { guildId: z.string(), soundId: z.string() },
		},
		async ({ guildId, soundId }) =>
			runArgs(env, { guildId, soundId }, async (client, args) => {
				await client.deleteGuildSoundboardSound(args.guildId, args.soundId);
				return `Deleted sound ${args.soundId}`;
			}),
	);

	server.registerTool(
		"discord_send_soundboard_sound",
		{
			description: "Send a soundboard sound to a voice channel",
			inputSchema: {
				channelId: z.string(),
				soundId: z.string(),
				sourceGuildId: z.string().optional(),
			},
		},
		async ({ channelId, soundId, sourceGuildId }) =>
			runArgs(env, { channelId, soundId, sourceGuildId }, async (client, args) => {
				await client.sendSoundboardSound(args.channelId, args.soundId, args.sourceGuildId);
				return `Sent soundboard sound ${args.soundId}`;
			}),
	);
}

function registerEventsStageAutomodPollVoiceTools(
	server: McpServer,
	env: ToolEnv,
	run: RunFn,
	runArgs: RunArgs,
	jsonObject: z.ZodType<Record<string, unknown>>,
) {
	server.registerTool(
		"discord_list_scheduled_events",
		{
			description: "List guild scheduled events",
			inputSchema: {
				guildId: z.string(),
				withUserCount: z.boolean().default(false),
			},
		},
		async ({ guildId, withUserCount }) =>
			runArgs(env, { guildId, withUserCount }, (client, args) =>
				client.listScheduledEvents(args.guildId, args.withUserCount),
			),
	);

	server.registerTool(
		"discord_create_scheduled_event",
		{
			description: "Create a scheduled event",
			inputSchema: { guildId: z.string(), body: jsonObject },
		},
		async ({ guildId, body }) =>
			runArgs(env, { guildId, body }, (client, args) =>
				client.createScheduledEvent(args.guildId, args.body),
			),
	);

	server.registerTool(
		"discord_get_scheduled_event",
		{
			description: "Get a scheduled event",
			inputSchema: {
				guildId: z.string(),
				eventId: z.string(),
				withUserCount: z.boolean().default(false),
			},
		},
		async ({ guildId, eventId, withUserCount }) =>
			runArgs(env, { guildId, eventId, withUserCount }, (client, args) =>
				client.getScheduledEvent(args.guildId, args.eventId, args.withUserCount),
			),
	);

	server.registerTool(
		"discord_edit_scheduled_event",
		{
			description: "Edit a scheduled event",
			inputSchema: { guildId: z.string(), eventId: z.string(), body: jsonObject },
		},
		async ({ guildId, eventId, body }) =>
			runArgs(env, { guildId, eventId, body }, (client, args) =>
				client.editScheduledEvent(args.guildId, args.eventId, args.body),
			),
	);

	server.registerTool(
		"discord_delete_scheduled_event",
		{
			description: "Delete a scheduled event",
			inputSchema: { guildId: z.string(), eventId: z.string() },
		},
		async ({ guildId, eventId }) =>
			runArgs(env, { guildId, eventId }, async (client, args) => {
				await client.deleteScheduledEvent(args.guildId, args.eventId);
				return `Deleted event ${args.eventId}`;
			}),
	);

	server.registerTool(
		"discord_list_event_users",
		{
			description: "List users interested in a scheduled event",
			inputSchema: {
				guildId: z.string(),
				eventId: z.string(),
				limit: z.number().int().optional(),
				withMember: z.boolean().optional(),
				before: z.string().optional(),
				after: z.string().optional(),
			},
		},
		async ({ guildId, eventId, limit, withMember, before, after }) =>
			runArgs(env, { guildId, eventId, limit, withMember, before, after }, (client, args) =>
				client.listScheduledEventUsers(args.guildId, args.eventId, {
					limit: args.limit,
					withMember: args.withMember,
					before: args.before,
					after: args.after,
				}),
			),
	);

	server.registerTool(
		"discord_create_stage_instance",
		{
			description: "Create a stage instance",
			inputSchema: { body: jsonObject },
		},
		async ({ body }) => runArgs(env, body, (client, b) => client.createStageInstance(b)),
	);

	server.registerTool(
		"discord_get_stage_instance",
		{
			description: "Get a stage instance",
			inputSchema: { channelId: z.string() },
		},
		async ({ channelId }) =>
			runArgs(env, channelId, (client, id) => client.getStageInstance(id)),
	);

	server.registerTool(
		"discord_edit_stage_instance",
		{
			description: "Edit a stage instance",
			inputSchema: { channelId: z.string(), body: jsonObject },
		},
		async ({ channelId, body }) =>
			runArgs(env, { channelId, body }, (client, args) =>
				client.editStageInstance(args.channelId, args.body),
			),
	);

	server.registerTool(
		"discord_delete_stage_instance",
		{
			description: "Delete a stage instance",
			inputSchema: { channelId: z.string() },
		},
		async ({ channelId }) =>
			runArgs(env, channelId, async (client, id) => {
				await client.deleteStageInstance(id);
				return `Deleted stage instance for ${id}`;
			}),
	);

	server.registerTool(
		"discord_list_automod_rules",
		{
			description: "List auto moderation rules",
			inputSchema: { guildId: z.string() },
		},
		async ({ guildId }) => runArgs(env, guildId, (client, id) => client.listAutoModRules(id)),
	);

	server.registerTool(
		"discord_get_automod_rule",
		{
			description: "Get an auto moderation rule",
			inputSchema: { guildId: z.string(), ruleId: z.string() },
		},
		async ({ guildId, ruleId }) =>
			runArgs(env, { guildId, ruleId }, (client, args) =>
				client.getAutoModRule(args.guildId, args.ruleId),
			),
	);

	server.registerTool(
		"discord_create_automod_rule",
		{
			description: "Create an auto moderation rule",
			inputSchema: { guildId: z.string(), body: jsonObject },
		},
		async ({ guildId, body }) =>
			runArgs(env, { guildId, body }, (client, args) =>
				client.createAutoModRule(args.guildId, args.body),
			),
	);

	server.registerTool(
		"discord_edit_automod_rule",
		{
			description: "Edit an auto moderation rule",
			inputSchema: { guildId: z.string(), ruleId: z.string(), body: jsonObject },
		},
		async ({ guildId, ruleId, body }) =>
			runArgs(env, { guildId, ruleId, body }, (client, args) =>
				client.editAutoModRule(args.guildId, args.ruleId, args.body),
			),
	);

	server.registerTool(
		"discord_delete_automod_rule",
		{
			description: "Delete an auto moderation rule",
			inputSchema: { guildId: z.string(), ruleId: z.string() },
		},
		async ({ guildId, ruleId }) =>
			runArgs(env, { guildId, ruleId }, async (client, args) => {
				await client.deleteAutoModRule(args.guildId, args.ruleId);
				return `Deleted automod rule ${args.ruleId}`;
			}),
	);

	server.registerTool(
		"discord_get_poll_answer_voters",
		{
			description: "List users who voted for a poll answer",
			inputSchema: {
				channelId: z.string(),
				messageId: z.string(),
				answerId: z.number().int(),
				after: z.string().optional(),
				limit: z.number().int().optional(),
			},
		},
		async ({ channelId, messageId, answerId, after, limit }) =>
			runArgs(env, { channelId, messageId, answerId, after, limit }, (client, args) =>
				client.getPollAnswerVoters(args.channelId, args.messageId, args.answerId, {
					after: args.after,
					limit: args.limit,
				}),
			),
	);

	server.registerTool(
		"discord_end_poll",
		{
			description: "Immediately end a poll",
			inputSchema: { channelId: z.string(), messageId: z.string() },
		},
		async ({ channelId, messageId }) =>
			runArgs(env, { channelId, messageId }, (client, args) =>
				client.endPoll(args.channelId, args.messageId),
			),
	);

	server.registerTool(
		"discord_list_voice_regions",
		{
			description: "List global voice regions",
			inputSchema: {},
		},
		async () => run(env, (client) => client.listVoiceRegions()),
	);

	server.registerTool(
		"discord_get_voice_state",
		{
			description: "Get a member voice state",
			inputSchema: { guildId: z.string(), userId: z.string() },
		},
		async ({ guildId, userId }) =>
			runArgs(env, { guildId, userId }, (client, args) =>
				client.getVoiceState(args.guildId, args.userId),
			),
	);

	server.registerTool(
		"discord_modify_voice_state",
		{
			description: "Modify a member voice state (channel, suppress, etc.)",
			inputSchema: { guildId: z.string(), userId: z.string(), body: jsonObject },
		},
		async ({ guildId, userId, body }) =>
			runArgs(env, { guildId, userId, body }, async (client, args) => {
				await client.modifyVoiceState(args.guildId, args.userId, args.body);
				return `Updated voice state for ${args.userId}`;
			}),
	);

	server.registerTool(
		"discord_modify_bot_voice_state",
		{
			description: "Modify the bot voice state",
			inputSchema: { guildId: z.string(), body: jsonObject },
		},
		async ({ guildId, body }) =>
			runArgs(env, { guildId, body }, async (client, args) => {
				await client.modifyCurrentVoiceState(args.guildId, args.body);
				return `Updated bot voice state in ${args.guildId}`;
			}),
	);
}

function registerWebhookTemplateAppUserTools(
	server: McpServer,
	env: ToolEnv,
	run: RunFn,
	runArgs: RunArgs,
	jsonObject: z.ZodType<Record<string, unknown>>,
	jsonArray: z.ZodType<unknown[]>,
) {
	server.registerTool(
		"discord_list_guild_webhooks",
		{
			description: "List all webhooks in a guild",
			inputSchema: { guildId: z.string() },
		},
		async ({ guildId }) => runArgs(env, guildId, (client, id) => client.listGuildWebhooks(id)),
	);

	server.registerTool(
		"discord_get_webhook",
		{
			description: "Get a webhook by ID (optional token)",
			inputSchema: {
				webhookId: z.string(),
				webhookToken: z.string().optional(),
			},
		},
		async ({ webhookId, webhookToken }) =>
			runArgs(env, { webhookId, webhookToken }, (client, args) =>
				client.getWebhook(args.webhookId, args.webhookToken),
			),
	);

	server.registerTool(
		"discord_edit_webhook",
		{
			description: "Edit a webhook",
			inputSchema: {
				webhookId: z.string(),
				body: jsonObject,
				webhookToken: z.string().optional(),
			},
		},
		async ({ webhookId, body, webhookToken }) =>
			runArgs(env, { webhookId, body, webhookToken }, (client, args) =>
				client.editWebhook(args.webhookId, args.body, args.webhookToken),
			),
	);

	server.registerTool(
		"discord_get_webhook_message",
		{
			description: "Get a webhook message",
			inputSchema: {
				webhookId: z.string(),
				webhookToken: z.string(),
				messageId: z.string(),
			},
		},
		async ({ webhookId, webhookToken, messageId }) =>
			runArgs(env, { webhookId, webhookToken, messageId }, (client, args) =>
				client.getWebhookMessage(args.webhookId, args.webhookToken, args.messageId),
			),
	);

	server.registerTool(
		"discord_edit_webhook_message",
		{
			description: "Edit a webhook message",
			inputSchema: {
				webhookId: z.string(),
				webhookToken: z.string(),
				messageId: z.string(),
				body: jsonObject,
			},
		},
		async ({ webhookId, webhookToken, messageId, body }) =>
			runArgs(env, { webhookId, webhookToken, messageId, body }, (client, args) =>
				client.editWebhookMessage(
					args.webhookId,
					args.webhookToken,
					args.messageId,
					args.body,
				),
			),
	);

	server.registerTool(
		"discord_delete_webhook_message",
		{
			description: "Delete a webhook message",
			inputSchema: {
				webhookId: z.string(),
				webhookToken: z.string(),
				messageId: z.string(),
			},
		},
		async ({ webhookId, webhookToken, messageId }) =>
			runArgs(env, { webhookId, webhookToken, messageId }, async (client, args) => {
				await client.deleteWebhookMessage(
					args.webhookId,
					args.webhookToken,
					args.messageId,
				);
				return `Deleted webhook message ${args.messageId}`;
			}),
	);

	server.registerTool(
		"discord_list_templates",
		{
			description: "List guild templates",
			inputSchema: { guildId: z.string() },
		},
		async ({ guildId }) => runArgs(env, guildId, (client, id) => client.listTemplates(id)),
	);

	server.registerTool(
		"discord_get_template",
		{
			description: "Get a guild template by code",
			inputSchema: { code: z.string() },
		},
		async ({ code }) => runArgs(env, code, (client, c) => client.getTemplate(c)),
	);

	server.registerTool(
		"discord_create_template",
		{
			description: "Create a guild template",
			inputSchema: {
				guildId: z.string(),
				name: z.string(),
				description: z.string().nullable().optional(),
			},
		},
		async ({ guildId, name, description }) =>
			runArgs(env, { guildId, name, description }, (client, args) =>
				client.createTemplate(args.guildId, args.name, args.description),
			),
	);

	server.registerTool(
		"discord_sync_template",
		{
			description: "Sync a guild template",
			inputSchema: { guildId: z.string(), code: z.string() },
		},
		async ({ guildId, code }) =>
			runArgs(env, { guildId, code }, (client, args) =>
				client.syncTemplate(args.guildId, args.code),
			),
	);

	server.registerTool(
		"discord_edit_template",
		{
			description: "Edit a guild template",
			inputSchema: {
				guildId: z.string(),
				code: z.string(),
				name: z.string().optional(),
				description: z.string().nullable().optional(),
			},
		},
		async ({ guildId, code, name, description }) =>
			runArgs(env, { guildId, code, name, description }, (client, args) =>
				client.editTemplate(args.guildId, args.code, {
					name: args.name,
					description: args.description,
				}),
			),
	);

	server.registerTool(
		"discord_delete_template",
		{
			description: "Delete a guild template",
			inputSchema: { guildId: z.string(), code: z.string() },
		},
		async ({ guildId, code }) =>
			runArgs(env, { guildId, code }, async (client, args) => {
				await client.deleteTemplate(args.guildId, args.code);
				return `Deleted template ${args.code}`;
			}),
	);

	server.registerTool(
		"discord_get_application",
		{
			description: "Get the current bot application object",
			inputSchema: {},
		},
		async () => run(env, (client) => client.getCurrentApplication()),
	);

	server.registerTool(
		"discord_edit_application",
		{
			description: "Edit the current application",
			inputSchema: { body: jsonObject },
		},
		async ({ body }) => runArgs(env, body, (client, b) => client.editCurrentApplication(b)),
	);

	server.registerTool(
		"discord_list_commands",
		{
			description: "List global application commands",
			inputSchema: { applicationId: z.string() },
		},
		async ({ applicationId }) =>
			runArgs(env, applicationId, (client, id) => client.listApplicationCommands(id)),
	);

	server.registerTool(
		"discord_create_command",
		{
			description: "Create a global application command",
			inputSchema: { applicationId: z.string(), body: jsonObject },
		},
		async ({ applicationId, body }) =>
			runArgs(env, { applicationId, body }, (client, args) =>
				client.createApplicationCommand(args.applicationId, args.body),
			),
	);

	server.registerTool(
		"discord_bulk_overwrite_commands",
		{
			description: "Bulk overwrite global application commands",
			inputSchema: {
				applicationId: z.string(),
				commands: jsonArray,
			},
		},
		async ({ applicationId, commands }) =>
			runArgs(env, { applicationId, commands }, (client, args) =>
				client.bulkOverwriteApplicationCommands(
					args.applicationId,
					args.commands as Record<string, unknown>[],
				),
			),
	);

	server.registerTool(
		"discord_get_command",
		{
			description: "Get a global application command",
			inputSchema: { applicationId: z.string(), commandId: z.string() },
		},
		async ({ applicationId, commandId }) =>
			runArgs(env, { applicationId, commandId }, (client, args) =>
				client.getApplicationCommand(args.applicationId, args.commandId),
			),
	);

	server.registerTool(
		"discord_edit_command",
		{
			description: "Edit a global application command",
			inputSchema: {
				applicationId: z.string(),
				commandId: z.string(),
				body: jsonObject,
			},
		},
		async ({ applicationId, commandId, body }) =>
			runArgs(env, { applicationId, commandId, body }, (client, args) =>
				client.editApplicationCommand(args.applicationId, args.commandId, args.body),
			),
	);

	server.registerTool(
		"discord_delete_command",
		{
			description: "Delete a global application command",
			inputSchema: { applicationId: z.string(), commandId: z.string() },
		},
		async ({ applicationId, commandId }) =>
			runArgs(env, { applicationId, commandId }, async (client, args) => {
				await client.deleteApplicationCommand(args.applicationId, args.commandId);
				return `Deleted command ${args.commandId}`;
			}),
	);

	server.registerTool(
		"discord_list_guild_commands",
		{
			description: "List guild application commands",
			inputSchema: { applicationId: z.string(), guildId: z.string() },
		},
		async ({ applicationId, guildId }) =>
			runArgs(env, { applicationId, guildId }, (client, args) =>
				client.listGuildApplicationCommands(args.applicationId, args.guildId),
			),
	);

	server.registerTool(
		"discord_create_guild_command",
		{
			description: "Create a guild application command",
			inputSchema: {
				applicationId: z.string(),
				guildId: z.string(),
				body: jsonObject,
			},
		},
		async ({ applicationId, guildId, body }) =>
			runArgs(env, { applicationId, guildId, body }, (client, args) =>
				client.createGuildApplicationCommand(args.applicationId, args.guildId, args.body),
			),
	);

	server.registerTool(
		"discord_bulk_overwrite_guild_commands",
		{
			description: "Bulk overwrite guild application commands",
			inputSchema: {
				applicationId: z.string(),
				guildId: z.string(),
				commands: jsonArray,
			},
		},
		async ({ applicationId, guildId, commands }) =>
			runArgs(env, { applicationId, guildId, commands }, (client, args) =>
				client.bulkOverwriteGuildApplicationCommands(
					args.applicationId,
					args.guildId,
					args.commands as Record<string, unknown>[],
				),
			),
	);

	server.registerTool(
		"discord_get_guild_command",
		{
			description: "Get a guild application command",
			inputSchema: {
				applicationId: z.string(),
				guildId: z.string(),
				commandId: z.string(),
			},
		},
		async ({ applicationId, guildId, commandId }) =>
			runArgs(env, { applicationId, guildId, commandId }, (client, args) =>
				client.getGuildApplicationCommand(args.applicationId, args.guildId, args.commandId),
			),
	);

	server.registerTool(
		"discord_edit_guild_command",
		{
			description: "Edit a guild application command",
			inputSchema: {
				applicationId: z.string(),
				guildId: z.string(),
				commandId: z.string(),
				body: jsonObject,
			},
		},
		async ({ applicationId, guildId, commandId, body }) =>
			runArgs(env, { applicationId, guildId, commandId, body }, (client, args) =>
				client.editGuildApplicationCommand(
					args.applicationId,
					args.guildId,
					args.commandId,
					args.body,
				),
			),
	);

	server.registerTool(
		"discord_delete_guild_command",
		{
			description: "Delete a guild application command",
			inputSchema: {
				applicationId: z.string(),
				guildId: z.string(),
				commandId: z.string(),
			},
		},
		async ({ applicationId, guildId, commandId }) =>
			runArgs(env, { applicationId, guildId, commandId }, async (client, args) => {
				await client.deleteGuildApplicationCommand(
					args.applicationId,
					args.guildId,
					args.commandId,
				);
				return `Deleted guild command ${args.commandId}`;
			}),
	);

	server.registerTool(
		"discord_get_guild_commands_permissions",
		{
			description: "Get permissions for all guild commands",
			inputSchema: { applicationId: z.string(), guildId: z.string() },
		},
		async ({ applicationId, guildId }) =>
			runArgs(env, { applicationId, guildId }, (client, args) =>
				client.getGuildApplicationCommandsPermissions(args.applicationId, args.guildId),
			),
	);

	server.registerTool(
		"discord_get_command_permissions",
		{
			description: "Get permissions for a command",
			inputSchema: {
				applicationId: z.string(),
				guildId: z.string(),
				commandId: z.string(),
			},
		},
		async ({ applicationId, guildId, commandId }) =>
			runArgs(env, { applicationId, guildId, commandId }, (client, args) =>
				client.getApplicationCommandPermissions(
					args.applicationId,
					args.guildId,
					args.commandId,
				),
			),
	);

	server.registerTool(
		"discord_edit_command_permissions",
		{
			description: "Edit permissions for a command",
			inputSchema: {
				applicationId: z.string(),
				guildId: z.string(),
				commandId: z.string(),
				permissions: jsonArray,
			},
		},
		async ({ applicationId, guildId, commandId, permissions }) =>
			runArgs(env, { applicationId, guildId, commandId, permissions }, (client, args) =>
				client.editApplicationCommandPermissions(
					args.applicationId,
					args.guildId,
					args.commandId,
					args.permissions as Record<string, unknown>[],
				),
			),
	);

	server.registerTool(
		"discord_list_application_emojis",
		{
			description: "List application emojis",
			inputSchema: { applicationId: z.string() },
		},
		async ({ applicationId }) =>
			runArgs(env, applicationId, (client, id) => client.listApplicationEmojis(id)),
	);

	server.registerTool(
		"discord_create_application_emoji",
		{
			description: "Create an application emoji",
			inputSchema: {
				applicationId: z.string(),
				name: z.string(),
				imageDataUri: z.string(),
			},
		},
		async ({ applicationId, name, imageDataUri }) =>
			runArgs(env, { applicationId, name, imageDataUri }, (client, args) =>
				client.createApplicationEmoji(args.applicationId, {
					name: args.name,
					imageDataUri: args.imageDataUri,
				}),
			),
	);

	server.registerTool(
		"discord_get_application_emoji",
		{
			description: "Get an application emoji",
			inputSchema: { applicationId: z.string(), emojiId: z.string() },
		},
		async ({ applicationId, emojiId }) =>
			runArgs(env, { applicationId, emojiId }, (client, args) =>
				client.getApplicationEmoji(args.applicationId, args.emojiId),
			),
	);

	server.registerTool(
		"discord_edit_application_emoji",
		{
			description: "Edit an application emoji",
			inputSchema: {
				applicationId: z.string(),
				emojiId: z.string(),
				body: jsonObject,
			},
		},
		async ({ applicationId, emojiId, body }) =>
			runArgs(env, { applicationId, emojiId, body }, (client, args) =>
				client.editApplicationEmoji(args.applicationId, args.emojiId, args.body),
			),
	);

	server.registerTool(
		"discord_delete_application_emoji",
		{
			description: "Delete an application emoji",
			inputSchema: { applicationId: z.string(), emojiId: z.string() },
		},
		async ({ applicationId, emojiId }) =>
			runArgs(env, { applicationId, emojiId }, async (client, args) => {
				await client.deleteApplicationEmoji(args.applicationId, args.emojiId);
				return `Deleted application emoji ${args.emojiId}`;
			}),
	);

	server.registerTool(
		"discord_list_skus",
		{
			description: "List SKUs for the application",
			inputSchema: { applicationId: z.string() },
		},
		async ({ applicationId }) =>
			runArgs(env, applicationId, (client, id) => client.listSkus(id)),
	);

	server.registerTool(
		"discord_list_entitlements",
		{
			description: "List entitlements",
			inputSchema: {
				applicationId: z.string(),
				userId: z.string().optional(),
				skuIds: z.array(z.string()).optional(),
				before: z.string().optional(),
				after: z.string().optional(),
				limit: z.number().int().optional(),
				guildId: z.string().optional(),
				excludeEnded: z.boolean().optional(),
			},
		},
		async ({ applicationId, userId, skuIds, before, after, limit, guildId, excludeEnded }) =>
			runArgs(
				env,
				{ applicationId, userId, skuIds, before, after, limit, guildId, excludeEnded },
				(client, args) =>
					client.listEntitlements(args.applicationId, {
						userId: args.userId,
						skuIds: args.skuIds,
						before: args.before,
						after: args.after,
						limit: args.limit,
						guildId: args.guildId,
						excludeEnded: args.excludeEnded,
					}),
			),
	);

	server.registerTool(
		"discord_get_entitlement",
		{
			description: "Get an entitlement",
			inputSchema: { applicationId: z.string(), entitlementId: z.string() },
		},
		async ({ applicationId, entitlementId }) =>
			runArgs(env, { applicationId, entitlementId }, (client, args) =>
				client.getEntitlement(args.applicationId, args.entitlementId),
			),
	);

	server.registerTool(
		"discord_create_test_entitlement",
		{
			description: "Create a test entitlement",
			inputSchema: { applicationId: z.string(), body: jsonObject },
		},
		async ({ applicationId, body }) =>
			runArgs(env, { applicationId, body }, (client, args) =>
				client.createTestEntitlement(args.applicationId, args.body),
			),
	);

	server.registerTool(
		"discord_delete_test_entitlement",
		{
			description: "Delete a test entitlement",
			inputSchema: { applicationId: z.string(), entitlementId: z.string() },
		},
		async ({ applicationId, entitlementId }) =>
			runArgs(env, { applicationId, entitlementId }, async (client, args) => {
				await client.deleteTestEntitlement(args.applicationId, args.entitlementId);
				return `Deleted entitlement ${args.entitlementId}`;
			}),
	);

	server.registerTool(
		"discord_consume_entitlement",
		{
			description: "Consume an entitlement",
			inputSchema: { applicationId: z.string(), entitlementId: z.string() },
		},
		async ({ applicationId, entitlementId }) =>
			runArgs(env, { applicationId, entitlementId }, async (client, args) => {
				await client.consumeEntitlement(args.applicationId, args.entitlementId);
				return `Consumed entitlement ${args.entitlementId}`;
			}),
	);

	server.registerTool(
		"discord_get_role_connection_metadata",
		{
			description: "Get application role connection metadata",
			inputSchema: { applicationId: z.string() },
		},
		async ({ applicationId }) =>
			runArgs(env, applicationId, (client, id) =>
				client.getApplicationRoleConnectionMetadata(id),
			),
	);

	server.registerTool(
		"discord_update_role_connection_metadata",
		{
			description: "Update application role connection metadata",
			inputSchema: { applicationId: z.string(), metadata: jsonArray },
		},
		async ({ applicationId, metadata }) =>
			runArgs(env, { applicationId, metadata }, (client, args) =>
				client.updateApplicationRoleConnectionMetadata(
					args.applicationId,
					args.metadata as Record<string, unknown>[],
				),
			),
	);

	server.registerTool(
		"discord_get_user",
		{
			description: "Get a user by ID",
			inputSchema: { userId: z.string() },
		},
		async ({ userId }) => runArgs(env, userId, (client, id) => client.getUser(id)),
	);

	server.registerTool(
		"discord_edit_bot_user",
		{
			description: "Edit the bot user (username/avatar/banner)",
			inputSchema: { body: jsonObject },
		},
		async ({ body }) => runArgs(env, body, (client, b) => client.editCurrentUser(b)),
	);

	server.registerTool(
		"discord_create_dm",
		{
			description: "Open (or fetch) a DM channel with a user",
			inputSchema: { recipientId: z.string() },
		},
		async ({ recipientId }) => runArgs(env, recipientId, (client, id) => client.createDm(id)),
	);

	server.registerTool(
		"discord_create_interaction_response",
		{
			description:
				"Respond to an interaction (requires interaction id+token from Discord; Gateway/HTTP interactions not hosted here)",
			inputSchema: {
				interactionId: z.string(),
				interactionToken: z.string(),
				body: jsonObject,
			},
		},
		async ({ interactionId, interactionToken, body }) =>
			runArgs(env, { interactionId, interactionToken, body }, (client, args) =>
				client.createInteractionResponse(
					args.interactionId,
					args.interactionToken,
					args.body,
				),
			),
	);

	server.registerTool(
		"discord_get_original_interaction_response",
		{
			description: "Get original interaction response",
			inputSchema: { applicationId: z.string(), interactionToken: z.string() },
		},
		async ({ applicationId, interactionToken }) =>
			runArgs(env, { applicationId, interactionToken }, (client, args) =>
				client.getOriginalInteractionResponse(args.applicationId, args.interactionToken),
			),
	);

	server.registerTool(
		"discord_edit_original_interaction_response",
		{
			description: "Edit original interaction response",
			inputSchema: {
				applicationId: z.string(),
				interactionToken: z.string(),
				body: jsonObject,
			},
		},
		async ({ applicationId, interactionToken, body }) =>
			runArgs(env, { applicationId, interactionToken, body }, (client, args) =>
				client.editOriginalInteractionResponse(
					args.applicationId,
					args.interactionToken,
					args.body,
				),
			),
	);

	server.registerTool(
		"discord_delete_original_interaction_response",
		{
			description: "Delete original interaction response",
			inputSchema: { applicationId: z.string(), interactionToken: z.string() },
		},
		async ({ applicationId, interactionToken }) =>
			runArgs(env, { applicationId, interactionToken }, async (client, args) => {
				await client.deleteOriginalInteractionResponse(
					args.applicationId,
					args.interactionToken,
				);
				return "Deleted original interaction response";
			}),
	);

	server.registerTool(
		"discord_create_followup_message",
		{
			description: "Create an interaction followup message",
			inputSchema: {
				applicationId: z.string(),
				interactionToken: z.string(),
				body: jsonObject,
			},
		},
		async ({ applicationId, interactionToken, body }) =>
			runArgs(env, { applicationId, interactionToken, body }, (client, args) =>
				client.createFollowupMessage(args.applicationId, args.interactionToken, args.body),
			),
	);
}

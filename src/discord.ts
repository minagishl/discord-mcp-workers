const DISCORD_API_BASE = "https://discord.com/api/v10";

const CHANNEL_TYPES: Record<number, string> = {
	0: "text",
	2: "voice",
	4: "category",
	5: "announcement",
	13: "stage",
	15: "forum",
};

export class DiscordApiError extends Error {
	constructor(
		message: string,
		readonly status: number,
		readonly body: string,
	) {
		super(message);
		this.name = "DiscordApiError";
	}
}

export type DiscordRecord = Record<string, unknown>;

export type MessagePayload = {
	content?: string;
	embeds?: DiscordRecord[];
	poll?: DiscordRecord;
	message_reference?: { message_id: string };
};

export type ReadMessagesOptions = {
	limit: number;
	before?: string;
	after?: string;
	around?: string;
};

export type EditChannelOptions = {
	name?: string;
	topic?: string | null;
	nsfw?: boolean;
	rate_limit_per_user?: number;
	parent_id?: string | null;
	position?: number;
};

export type CreateInviteOptions = {
	max_age?: number;
	max_uses?: number;
	temporary?: boolean;
	unique?: boolean;
};

export class DiscordClient {
	constructor(private readonly botToken: string) {}

	private headers(extra?: HeadersInit): HeadersInit {
		return {
			Authorization: `Bot ${this.botToken}`,
			"Content-Type": "application/json",
			"User-Agent": "discord-mcp-workers (https://github.com/minagishl/discord-mcp-workers)",
			...extra,
		};
	}

	private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
		const response = await fetch(`${DISCORD_API_BASE}${path}`, {
			method,
			headers: this.headers(),
			body: body === undefined ? undefined : JSON.stringify(body),
		});

		const text = await response.text();
		if (!response.ok) {
			let detail = text;
			try {
				const parsed = JSON.parse(text) as { message?: string };
				if (parsed.message) detail = parsed.message;
			} catch {
				// keep raw body
			}
			throw new DiscordApiError(
				`Discord API ${method} ${path} failed: ${detail}`,
				response.status,
				text,
			);
		}

		if (response.status === 204 || !text) return undefined as T;
		return JSON.parse(text) as T;
	}

	// --- User / Guild ---

	getCurrentUser() {
		return this.request<DiscordRecord>("GET", "/users/@me");
	}

	listServers() {
		return this.request<DiscordRecord[]>("GET", "/users/@me/guilds");
	}

	getGuild(guildId: string) {
		return this.request<DiscordRecord>("GET", `/guilds/${guildId}?with_counts=true`);
	}

	getServerInfo(guildId: string) {
		return Promise.all([this.getGuild(guildId), this.listGuildChannels(guildId)]);
	}

	listGuildChannels(guildId: string) {
		return this.request<DiscordRecord[]>("GET", `/guilds/${guildId}/channels`);
	}

	listRoles(guildId: string) {
		return this.request<DiscordRecord[]>("GET", `/guilds/${guildId}/roles`);
	}

	listEmojis(guildId: string) {
		return this.request<DiscordRecord[]>("GET", `/guilds/${guildId}/emojis`);
	}

	getMember(guildId: string, userId: string) {
		return this.request<DiscordRecord>("GET", `/guilds/${guildId}/members/${userId}`);
	}

	listMembers(guildId: string, limit = 100, after?: string) {
		const params = new URLSearchParams({ limit: String(Math.min(limit, 1000)) });
		if (after) params.set("after", after);
		return this.request<DiscordRecord[]>("GET", `/guilds/${guildId}/members?${params}`);
	}

	addMemberRole(guildId: string, userId: string, roleId: string) {
		return this.request<void>("PUT", `/guilds/${guildId}/members/${userId}/roles/${roleId}`);
	}

	removeMemberRole(guildId: string, userId: string, roleId: string) {
		return this.request<void>("DELETE", `/guilds/${guildId}/members/${userId}/roles/${roleId}`);
	}

	kickMember(guildId: string, userId: string) {
		return this.request<void>("DELETE", `/guilds/${guildId}/members/${userId}`);
	}

	banMember(
		guildId: string,
		userId: string,
		options?: { deleteMessageDays?: number; reason?: string },
	) {
		const body: DiscordRecord = {};
		if (options?.deleteMessageDays !== undefined) {
			body.delete_message_days = options.deleteMessageDays;
		}
		if (options?.reason) body.reason = options.reason;
		return this.request<void>("PUT", `/guilds/${guildId}/bans/${userId}`, body);
	}

	unbanMember(guildId: string, userId: string) {
		return this.request<void>("DELETE", `/guilds/${guildId}/bans/${userId}`);
	}

	timeoutMember(guildId: string, userId: string, until: string | null, reason?: string) {
		const body: DiscordRecord = {
			communication_disabled_until: until,
		};
		if (reason) body.reason = reason;
		return this.request<DiscordRecord>("PATCH", `/guilds/${guildId}/members/${userId}`, body);
	}

	getAuditLog(
		guildId: string,
		options?: {
			limit?: number;
			userId?: string;
			actionType?: number;
			before?: string;
		},
	) {
		const params = new URLSearchParams();
		if (options?.limit) params.set("limit", String(options.limit));
		if (options?.userId) params.set("user_id", options.userId);
		if (options?.actionType !== undefined) {
			params.set("action_type", String(options.actionType));
		}
		if (options?.before) params.set("before", options.before);
		const q = params.toString();
		return this.request<DiscordRecord>(
			"GET",
			`/guilds/${guildId}/audit-logs${q ? `?${q}` : ""}`,
		);
	}

	// --- Channels ---

	getChannel(channelId: string) {
		return this.request<DiscordRecord>("GET", `/channels/${channelId}`);
	}

	editChannel(channelId: string, options: EditChannelOptions) {
		return this.request<DiscordRecord>("PATCH", `/channels/${channelId}`, options);
	}

	createGuildChannel(guildId: string, body: DiscordRecord) {
		return this.request<DiscordRecord>("POST", `/guilds/${guildId}/channels`, body);
	}

	createTextChannel(
		guildId: string,
		channelName: string,
		options?: { topic?: string; categoryId?: string },
	) {
		const body: DiscordRecord = { name: channelName, type: 0 };
		if (options?.topic) body.topic = options.topic;
		if (options?.categoryId) body.parent_id = options.categoryId;
		return this.createGuildChannel(guildId, body);
	}

	createVoiceChannel(
		guildId: string,
		channelName: string,
		options?: { categoryId?: string; userLimit?: number },
	) {
		const body: DiscordRecord = { name: channelName, type: 2 };
		if (options?.categoryId) body.parent_id = options.categoryId;
		if (options?.userLimit !== undefined) body.user_limit = options.userLimit;
		return this.createGuildChannel(guildId, body);
	}

	createAnnouncementChannel(
		guildId: string,
		channelName: string,
		options?: { topic?: string; categoryId?: string },
	) {
		const body: DiscordRecord = { name: channelName, type: 5 };
		if (options?.topic) body.topic = options.topic;
		if (options?.categoryId) body.parent_id = options.categoryId;
		return this.createGuildChannel(guildId, body);
	}

	createCategory(guildId: string, name: string) {
		return this.createGuildChannel(guildId, { name, type: 4 });
	}

	deleteChannel(channelId: string) {
		return this.request<void>("DELETE", `/channels/${channelId}`);
	}

	listWebhooks(channelId: string) {
		return this.request<DiscordRecord[]>("GET", `/channels/${channelId}/webhooks`);
	}

	createInvite(channelId: string, options?: CreateInviteOptions) {
		return this.request<DiscordRecord>("POST", `/channels/${channelId}/invites`, options ?? {});
	}

	// --- Messages ---

	readMessages(channelId: string, options: ReadMessagesOptions) {
		const params = new URLSearchParams({ limit: String(options.limit) });
		if (options.before) params.set("before", options.before);
		if (options.after) params.set("after", options.after);
		if (options.around) params.set("around", options.around);
		return this.request<DiscordRecord[]>("GET", `/channels/${channelId}/messages?${params}`);
	}

	getMessage(channelId: string, messageId: string) {
		return this.request<DiscordRecord>("GET", `/channels/${channelId}/messages/${messageId}`);
	}

	sendMessagePayload(channelId: string, payload: MessagePayload) {
		return this.request<DiscordRecord>("POST", `/channels/${channelId}/messages`, payload);
	}

	sendMessage(channelId: string, message: string, replyToMessageId?: string) {
		const payload: MessagePayload = { content: message };
		if (replyToMessageId) {
			payload.message_reference = { message_id: replyToMessageId };
		}
		return this.sendMessagePayload(channelId, payload);
	}

	editMessage(channelId: string, messageId: string, payload: MessagePayload) {
		return this.request<DiscordRecord>(
			"PATCH",
			`/channels/${channelId}/messages/${messageId}`,
			payload,
		);
	}

	deleteMessage(channelId: string, messageId: string) {
		return this.request<void>("DELETE", `/channels/${channelId}/messages/${messageId}`);
	}

	searchMessages(
		guildId: string,
		options: {
			content?: string;
			authorId?: string;
			channelId?: string;
			limit: number;
		},
	) {
		const params = new URLSearchParams();
		if (options.content) params.set("content", options.content);
		if (options.authorId) params.set("author_id", options.authorId);
		if (options.channelId) params.set("channel_id", options.channelId);
		params.set("limit", String(options.limit));
		return this.request<DiscordRecord>("GET", `/guilds/${guildId}/messages/search?${params}`);
	}

	pinMessage(channelId: string, messageId: string) {
		return this.request<void>("PUT", `/channels/${channelId}/pins/${messageId}`);
	}

	unpinMessage(channelId: string, messageId: string) {
		return this.request<void>("DELETE", `/channels/${channelId}/pins/${messageId}`);
	}

	listPins(channelId: string) {
		return this.request<{ items: DiscordRecord[] }>("GET", `/channels/${channelId}/pins`);
	}

	buildEmbed(options: {
		title?: string;
		description?: string;
		url?: string;
		color?: number;
		fields?: { name: string; value: string; inline?: boolean }[];
	}) {
		const embed: DiscordRecord = { type: "rich" };
		if (options.title) embed.title = options.title;
		if (options.description) embed.description = options.description;
		if (options.url) embed.url = options.url;
		if (options.color !== undefined) embed.color = options.color;
		if (options.fields?.length) embed.fields = options.fields;
		return embed;
	}

	buildPoll(
		question: string,
		answers: string[],
		durationHours: number,
		allowMultiselect = false,
	) {
		return {
			question: { text: question },
			answers: answers.map((text) => ({ poll_media: { text } })),
			duration: durationHours,
			allow_multiselect: allowMultiselect,
		};
	}

	// --- Reactions ---

	private encodeEmoji(emoji: string) {
		return encodeURIComponent(emoji);
	}

	addReaction(channelId: string, messageId: string, emoji: string) {
		return this.request<void>(
			"PUT",
			`/channels/${channelId}/messages/${messageId}/reactions/${this.encodeEmoji(emoji)}/@me`,
		);
	}

	removeReaction(channelId: string, messageId: string, emoji: string) {
		return this.request<void>(
			"DELETE",
			`/channels/${channelId}/messages/${messageId}/reactions/${this.encodeEmoji(emoji)}/@me`,
		);
	}

	getReactionUsers(
		channelId: string,
		messageId: string,
		emoji: string,
		limit = 25,
		after?: string,
	) {
		const params = new URLSearchParams({ limit: String(limit) });
		if (after) params.set("after", after);
		const q = params.toString();
		return this.request<DiscordRecord[]>(
			"GET",
			`/channels/${channelId}/messages/${messageId}/reactions/${this.encodeEmoji(emoji)}?${q}`,
		);
	}

	clearReactions(channelId: string, messageId: string, emoji?: string) {
		const path = emoji
			? `/channels/${channelId}/messages/${messageId}/reactions/${this.encodeEmoji(emoji)}`
			: `/channels/${channelId}/messages/${messageId}/reactions`;
		return this.request<void>("DELETE", path);
	}

	// --- Threads / Forums ---

	createForumPost(forumChannelId: string, title: string, content: string) {
		return this.request<DiscordRecord>("POST", `/channels/${forumChannelId}/threads`, {
			name: title,
			message: { content },
		});
	}

	replyToThread(threadId: string, message: string) {
		return this.sendMessage(threadId, message);
	}

	createThread(channelId: string, messageId: string, name: string) {
		return this.request<DiscordRecord>(
			"POST",
			`/channels/${channelId}/messages/${messageId}/threads`,
			{ name },
		);
	}

	editThread(threadId: string, options: { name?: string; archived?: boolean; locked?: boolean }) {
		return this.request<DiscordRecord>("PATCH", `/channels/${threadId}`, options);
	}

	joinThread(threadId: string) {
		return this.request<void>("PUT", `/channels/${threadId}/thread-members/@me`);
	}

	leaveThread(threadId: string) {
		return this.request<void>("DELETE", `/channels/${threadId}/thread-members/@me`);
	}

	// --- Webhooks ---

	createWebhook(channelId: string, name: string) {
		return this.request<DiscordRecord>("POST", `/channels/${channelId}/webhooks`, { name });
	}

	async sendWebhookMessage(
		webhookId: string,
		webhookToken: string,
		content: string,
		options?: { username?: string; avatarURL?: string; embeds?: DiscordRecord[] },
	) {
		const body: DiscordRecord = { content };
		if (options?.username) body.username = options.username;
		if (options?.avatarURL) body.avatar_url = options.avatarURL;
		if (options?.embeds) body.embeds = options.embeds;

		const response = await fetch(`${DISCORD_API_BASE}/webhooks/${webhookId}/${webhookToken}`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		});

		if (!response.ok) {
			const text = await response.text();
			throw new DiscordApiError(`Webhook message failed: ${text}`, response.status, text);
		}
	}

	deleteWebhook(webhookId: string, webhookToken?: string) {
		const path = webhookToken
			? `/webhooks/${webhookId}/${webhookToken}`
			: `/webhooks/${webhookId}`;
		return this.request<void>("DELETE", path);
	}

	// --- Formatters ---

	formatServers(guilds: DiscordRecord[]) {
		return guilds.map((g) => ({
			id: g.id,
			name: g.name,
			icon: g.icon && g.id ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.webp` : null,
		}));
	}

	formatServerInfo(guild: DiscordRecord, channels: DiscordRecord[]) {
		const channelDetails = channels.map((c) => ({
			id: c.id,
			name: c.name,
			type: CHANNEL_TYPES[Number(c.type)] ?? `type_${String(c.type)}`,
			categoryId: c.parent_id ?? null,
			topic: c.topic ?? null,
		}));

		return {
			id: guild.id,
			name: guild.name,
			description: guild.description ?? null,
			memberCount: guild.approximate_member_count ?? null,
			channels: channelDetails,
		};
	}

	formatMessage(msg: DiscordRecord) {
		const author = msg.author as DiscordRecord | undefined;
		const ref = msg.message_reference as DiscordRecord | undefined;
		return {
			id: msg.id,
			content: msg.content,
			author: author
				? {
						id: author.id,
						username: author.username,
						bot: Boolean(author.bot),
					}
				: null,
			timestamp: msg.timestamp,
			replyTo: ref?.message_id ?? null,
			embeds: msg.embeds ?? [],
			pinned: msg.pinned ?? false,
		};
	}

	formatMessages(channelId: string, messages: DiscordRecord[]) {
		const formatted = messages
			.map((msg) => this.formatMessage(msg))
			.sort(
				(a, b) =>
					new Date(String(a.timestamp)).getTime() -
					new Date(String(b.timestamp)).getTime(),
			);

		return {
			channelId,
			messageCount: formatted.length,
			messages: formatted,
		};
	}

	formatForumChannels(channels: DiscordRecord[]) {
		return channels
			.filter((c) => Number(c.type) === 15)
			.map((c) => ({
				id: c.id,
				name: c.name,
				topic: c.topic ?? null,
			}));
	}

	formatMembers(members: DiscordRecord[]) {
		return members.map((m) => {
			const user = m.user as DiscordRecord | undefined;
			return {
				userId: user?.id ?? m.user_id,
				username: user?.username,
				nick: m.nick ?? null,
				roles: m.roles,
				joinedAt: m.joined_at,
			};
		});
	}

	formatRoles(roles: DiscordRecord[]) {
		return roles
			.sort((a, b) => Number(b.position) - Number(a.position))
			.map((r) => ({
				id: r.id,
				name: r.name,
				color: r.color,
				position: r.position,
				permissions: r.permissions,
				managed: r.managed,
			}));
	}
}

export function resolveDiscordToken(env: {
	DISCORD_BOT_TOKEN?: string;
	DISCORD_TOKEN?: string;
}): string | undefined {
	return env.DISCORD_BOT_TOKEN?.trim() || env.DISCORD_TOKEN?.trim();
}

export function createDiscordClient(token: string | undefined): DiscordClient {
	if (!token) {
		throw new Error(
			"Discord bot token is not configured. Set DISCORD_BOT_TOKEN (or DISCORD_TOKEN) via `wrangler secret put` or in .dev.vars for local development.",
		);
	}
	return new DiscordClient(token);
}

export function textToolResult(text: string) {
	return {
		content: [{ type: "text" as const, text }],
	};
}

export function jsonToolResult(data: unknown) {
	return textToolResult(JSON.stringify(data, null, 2));
}

export function errorToolResult(error: unknown) {
	const message =
		error instanceof DiscordApiError
			? `${error.message} (HTTP ${error.status})`
			: error instanceof Error
				? error.message
				: String(error);
	return {
		content: [{ type: "text" as const, text: `Error: ${message}` }],
		isError: true,
	};
}

export async function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

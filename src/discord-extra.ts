import { DiscordClient, type DiscordRecord } from "./discord";

function query(params: Record<string, string | number | boolean | undefined | null>) {
	const search = new URLSearchParams();
	for (const [key, value] of Object.entries(params)) {
		if (value === undefined || value === null || value === "") continue;
		search.set(key, String(value));
	}
	const q = search.toString();
	return q ? `?${q}` : "";
}

function base64ToUint8Array(data: string): Uint8Array {
	const raw = data.includes(",") ? data.split(",")[1]! : data;
	const binary = atob(raw);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	return bytes;
}

/** Extended Discord REST surface beyond the core client. */
export class DiscordClientExtra extends DiscordClient {
	// --- Messages / Channels extras ---

	bulkDeleteMessages(channelId: string, messageIds: string[]) {
		return this.request<void>("POST", `/channels/${channelId}/messages/bulk-delete`, {
			messages: messageIds,
		});
	}

	crosspostMessage(channelId: string, messageId: string) {
		return this.request<DiscordRecord>(
			"POST",
			`/channels/${channelId}/messages/${messageId}/crosspost`,
		);
	}

	removeUserReaction(channelId: string, messageId: string, emoji: string, userId: string) {
		return this.request<void>(
			"DELETE",
			`/channels/${channelId}/messages/${messageId}/reactions/${this.encodeEmoji(emoji)}/${userId}`,
		);
	}

	triggerTyping(channelId: string) {
		return this.request<void>("POST", `/channels/${channelId}/typing`);
	}

	followAnnouncementChannel(channelId: string, webhookChannelId: string) {
		return this.request<DiscordRecord>("POST", `/channels/${channelId}/followers`, {
			webhook_channel_id: webhookChannelId,
		});
	}

	listChannelInvites(channelId: string) {
		return this.request<DiscordRecord[]>("GET", `/channels/${channelId}/invites`);
	}

	modifyChannelPositions(
		guildId: string,
		positions: {
			id: string;
			position?: number | null;
			parent_id?: string | null;
			lock_permissions?: boolean;
		}[],
	) {
		return this.request<void>("PATCH", `/guilds/${guildId}/channels`, positions);
	}

	setVoiceStatus(channelId: string, status: string | null) {
		return this.request<void>("PUT", `/channels/${channelId}/voice-status`, { status });
	}

	createForumChannel(
		guildId: string,
		name: string,
		options?: { topic?: string; categoryId?: string },
	) {
		const body: DiscordRecord = { name, type: 15 };
		if (options?.topic) body.topic = options.topic;
		if (options?.categoryId) body.parent_id = options.categoryId;
		return this.createGuildChannel(guildId, body);
	}

	createStageChannel(guildId: string, name: string, options?: { categoryId?: string }) {
		const body: DiscordRecord = { name, type: 13 };
		if (options?.categoryId) body.parent_id = options.categoryId;
		return this.createGuildChannel(guildId, body);
	}

	createMediaChannel(
		guildId: string,
		name: string,
		options?: { topic?: string; categoryId?: string },
	) {
		const body: DiscordRecord = { name, type: 16 };
		if (options?.topic) body.topic = options.topic;
		if (options?.categoryId) body.parent_id = options.categoryId;
		return this.createGuildChannel(guildId, body);
	}

	sendMessageWithComponents(
		channelId: string,
		payload: {
			content?: string;
			components: DiscordRecord[];
			embeds?: DiscordRecord[];
			replyToMessageId?: string;
		},
	) {
		return this.sendMessagePayload(channelId, {
			content: payload.content,
			components: payload.components,
			embeds: payload.embeds,
			message_reference: payload.replyToMessageId
				? { message_id: payload.replyToMessageId }
				: undefined,
		});
	}

	sendStickers(channelId: string, stickerIds: string[], content?: string) {
		return this.sendMessagePayload(channelId, {
			content,
			sticker_ids: stickerIds,
		});
	}

	async sendAttachment(
		channelId: string,
		options: {
			filename: string;
			contentType?: string;
			base64Data: string;
			content?: string;
		},
	) {
		const form = new FormData();
		const bytes = base64ToUint8Array(options.base64Data);
		const blob = new Blob([bytes], {
			type: options.contentType ?? "application/octet-stream",
		});
		form.append("files[0]", blob, options.filename);
		form.append(
			"payload_json",
			JSON.stringify({
				content: options.content ?? "",
				attachments: [{ id: 0, filename: options.filename }],
			}),
		);
		return this.requestForm<DiscordRecord>("POST", `/channels/${channelId}/messages`, form);
	}

	// --- Invites ---

	getInvite(code: string, withCounts = true, withExpiration = true) {
		return this.request<DiscordRecord>(
			"GET",
			`/invites/${code}${query({ with_counts: withCounts, with_expiration: withExpiration })}`,
		);
	}

	deleteInvite(code: string) {
		return this.request<DiscordRecord>("DELETE", `/invites/${code}`);
	}

	listGuildInvites(guildId: string) {
		return this.request<DiscordRecord[]>("GET", `/guilds/${guildId}/invites`);
	}

	// --- Threads extras ---

	createThreadWithoutMessage(
		channelId: string,
		options: {
			name: string;
			autoArchiveDuration?: number;
			type?: number;
			invitable?: boolean;
			rateLimitPerUser?: number;
		},
	) {
		const body: DiscordRecord = { name: options.name };
		if (options.autoArchiveDuration !== undefined) {
			body.auto_archive_duration = options.autoArchiveDuration;
		}
		if (options.type !== undefined) body.type = options.type;
		if (options.invitable !== undefined) body.invitable = options.invitable;
		if (options.rateLimitPerUser !== undefined) {
			body.rate_limit_per_user = options.rateLimitPerUser;
		}
		return this.request<DiscordRecord>("POST", `/channels/${channelId}/threads`, body);
	}

	listActiveThreads(guildId: string) {
		return this.request<DiscordRecord>("GET", `/guilds/${guildId}/threads/active`);
	}

	listArchivedThreads(
		channelId: string,
		type: "public" | "private",
		options?: { before?: string; limit?: number },
	) {
		return this.request<DiscordRecord>(
			"GET",
			`/channels/${channelId}/threads/archived/${type}${query({
				before: options?.before,
				limit: options?.limit,
			})}`,
		);
	}

	listJoinedPrivateArchivedThreads(
		channelId: string,
		options?: { before?: string; limit?: number },
	) {
		return this.request<DiscordRecord>(
			"GET",
			`/channels/${channelId}/users/@me/threads/archived/private${query({
				before: options?.before,
				limit: options?.limit,
			})}`,
		);
	}

	listThreadMembers(threadId: string, options?: { after?: string; limit?: number }) {
		return this.request<DiscordRecord[]>(
			"GET",
			`/channels/${threadId}/thread-members${query({
				after: options?.after,
				limit: options?.limit,
				with_member: true,
			})}`,
		);
	}

	getThreadMember(threadId: string, userId: string) {
		return this.request<DiscordRecord>(
			"GET",
			`/channels/${threadId}/thread-members/${userId}?with_member=true`,
		);
	}

	addThreadMember(threadId: string, userId: string) {
		return this.request<void>("PUT", `/channels/${threadId}/thread-members/${userId}`);
	}

	removeThreadMember(threadId: string, userId: string) {
		return this.request<void>("DELETE", `/channels/${threadId}/thread-members/${userId}`);
	}

	// --- Guild admin ---

	editGuild(guildId: string, body: DiscordRecord) {
		return this.request<DiscordRecord>("PATCH", `/guilds/${guildId}`, body);
	}

	getGuildPreview(guildId: string) {
		return this.request<DiscordRecord>("GET", `/guilds/${guildId}/preview`);
	}

	getRole(guildId: string, roleId: string) {
		return this.request<DiscordRecord>("GET", `/guilds/${guildId}/roles/${roleId}`);
	}

	modifyRolePositions(guildId: string, positions: { id: string; position?: number | null }[]) {
		return this.request<DiscordRecord[]>("PATCH", `/guilds/${guildId}/roles`, positions);
	}

	getRoleMemberCounts(guildId: string) {
		return this.request<DiscordRecord>("GET", `/guilds/${guildId}/roles/member-counts`);
	}

	editMember(guildId: string, userId: string, body: DiscordRecord) {
		return this.request<DiscordRecord>("PATCH", `/guilds/${guildId}/members/${userId}`, body);
	}

	editCurrentMember(guildId: string, body: DiscordRecord) {
		return this.request<DiscordRecord>("PATCH", `/guilds/${guildId}/members/@me`, body);
	}

	searchMembers(guildId: string, queryText: string, limit = 1) {
		return this.request<DiscordRecord[]>(
			"GET",
			`/guilds/${guildId}/members/search${query({ query: queryText, limit })}`,
		);
	}

	listBans(guildId: string, options?: { limit?: number; before?: string; after?: string }) {
		return this.request<DiscordRecord[]>(
			"GET",
			`/guilds/${guildId}/bans${query({
				limit: options?.limit,
				before: options?.before,
				after: options?.after,
			})}`,
		);
	}

	getBan(guildId: string, userId: string) {
		return this.request<DiscordRecord>("GET", `/guilds/${guildId}/bans/${userId}`);
	}

	bulkBan(guildId: string, userIds: string[], options?: { deleteMessageSeconds?: number }) {
		const body: DiscordRecord = { user_ids: userIds };
		if (options?.deleteMessageSeconds !== undefined) {
			body.delete_message_seconds = options.deleteMessageSeconds;
		}
		return this.request<DiscordRecord>("POST", `/guilds/${guildId}/bulk-ban`, body);
	}

	getPruneCount(guildId: string, options?: { days?: number; includeRoles?: string[] }) {
		const params = new URLSearchParams();
		if (options?.days !== undefined) params.set("days", String(options.days));
		if (options?.includeRoles?.length) {
			for (const role of options.includeRoles) params.append("include_roles", role);
		}
		const q = params.toString();
		return this.request<DiscordRecord>("GET", `/guilds/${guildId}/prune${q ? `?${q}` : ""}`);
	}

	beginPrune(
		guildId: string,
		options?: {
			days?: number;
			computePruneCount?: boolean;
			includeRoles?: string[];
			reason?: string;
		},
	) {
		const body: DiscordRecord = {};
		if (options?.days !== undefined) body.days = options.days;
		if (options?.computePruneCount !== undefined) {
			body.compute_prune_count = options.computePruneCount;
		}
		if (options?.includeRoles) body.include_roles = options.includeRoles;
		if (options?.reason) body.reason = options.reason;
		return this.request<DiscordRecord>("POST", `/guilds/${guildId}/prune`, body);
	}

	listGuildVoiceRegions(guildId: string) {
		return this.request<DiscordRecord[]>("GET", `/guilds/${guildId}/regions`);
	}

	listIntegrations(guildId: string) {
		return this.request<DiscordRecord[]>("GET", `/guilds/${guildId}/integrations`);
	}

	deleteIntegration(guildId: string, integrationId: string) {
		return this.request<void>("DELETE", `/guilds/${guildId}/integrations/${integrationId}`);
	}

	getVanityUrl(guildId: string) {
		return this.request<DiscordRecord>("GET", `/guilds/${guildId}/vanity-url`);
	}

	getWidgetSettings(guildId: string) {
		return this.request<DiscordRecord>("GET", `/guilds/${guildId}/widget`);
	}

	editWidgetSettings(guildId: string, body: DiscordRecord) {
		return this.request<DiscordRecord>("PATCH", `/guilds/${guildId}/widget`, body);
	}

	getWidgetJson(guildId: string) {
		return this.request<DiscordRecord>("GET", `/guilds/${guildId}/widget.json`);
	}

	getWelcomeScreen(guildId: string) {
		return this.request<DiscordRecord>("GET", `/guilds/${guildId}/welcome-screen`);
	}

	editWelcomeScreen(guildId: string, body: DiscordRecord) {
		return this.request<DiscordRecord>("PATCH", `/guilds/${guildId}/welcome-screen`, body);
	}

	getOnboarding(guildId: string) {
		return this.request<DiscordRecord>("GET", `/guilds/${guildId}/onboarding`);
	}

	editOnboarding(guildId: string, body: DiscordRecord) {
		return this.request<DiscordRecord>("PUT", `/guilds/${guildId}/onboarding`, body);
	}

	setIncidentActions(guildId: string, body: DiscordRecord) {
		return this.request<DiscordRecord>("PUT", `/guilds/${guildId}/incident-actions`, body);
	}

	leaveGuild(guildId: string) {
		return this.request<void>("DELETE", `/users/@me/guilds/${guildId}`);
	}

	// --- Emojis ---

	getEmoji(guildId: string, emojiId: string) {
		return this.request<DiscordRecord>("GET", `/guilds/${guildId}/emojis/${emojiId}`);
	}

	createEmoji(
		guildId: string,
		options: { name: string; imageDataUri: string; roles?: string[] },
	) {
		const body: DiscordRecord = { name: options.name, image: options.imageDataUri };
		if (options.roles) body.roles = options.roles;
		return this.request<DiscordRecord>("POST", `/guilds/${guildId}/emojis`, body);
	}

	editEmoji(
		guildId: string,
		emojiId: string,
		options: { name?: string; roles?: string[] | null },
	) {
		return this.request<DiscordRecord>(
			"PATCH",
			`/guilds/${guildId}/emojis/${emojiId}`,
			options,
		);
	}

	deleteEmoji(guildId: string, emojiId: string) {
		return this.request<void>("DELETE", `/guilds/${guildId}/emojis/${emojiId}`);
	}

	// --- Stickers ---

	listGuildStickers(guildId: string) {
		return this.request<DiscordRecord[]>("GET", `/guilds/${guildId}/stickers`);
	}

	getSticker(stickerId: string) {
		return this.request<DiscordRecord>("GET", `/stickers/${stickerId}`);
	}

	listStickerPacks() {
		return this.request<DiscordRecord>("GET", "/sticker-packs");
	}

	async createSticker(
		guildId: string,
		options: {
			name: string;
			description: string;
			tags: string;
			filename: string;
			contentType?: string;
			base64Data: string;
		},
	) {
		const form = new FormData();
		form.append("name", options.name);
		form.append("description", options.description);
		form.append("tags", options.tags);
		const bytes = base64ToUint8Array(options.base64Data);
		form.append(
			"file",
			new Blob([bytes], { type: options.contentType ?? "image/png" }),
			options.filename,
		);
		return this.requestForm<DiscordRecord>("POST", `/guilds/${guildId}/stickers`, form);
	}

	editSticker(
		guildId: string,
		stickerId: string,
		options: { name?: string; description?: string | null; tags?: string },
	) {
		return this.request<DiscordRecord>(
			"PATCH",
			`/guilds/${guildId}/stickers/${stickerId}`,
			options,
		);
	}

	deleteSticker(guildId: string, stickerId: string) {
		return this.request<void>("DELETE", `/guilds/${guildId}/stickers/${stickerId}`);
	}

	// --- Soundboard ---

	listDefaultSoundboardSounds() {
		return this.request<DiscordRecord[]>("GET", "/soundboard-default-sounds");
	}

	listGuildSoundboardSounds(guildId: string) {
		return this.request<DiscordRecord>("GET", `/guilds/${guildId}/soundboard-sounds`);
	}

	getGuildSoundboardSound(guildId: string, soundId: string) {
		return this.request<DiscordRecord>(
			"GET",
			`/guilds/${guildId}/soundboard-sounds/${soundId}`,
		);
	}

	createGuildSoundboardSound(guildId: string, body: DiscordRecord) {
		return this.request<DiscordRecord>("POST", `/guilds/${guildId}/soundboard-sounds`, body);
	}

	editGuildSoundboardSound(guildId: string, soundId: string, body: DiscordRecord) {
		return this.request<DiscordRecord>(
			"PATCH",
			`/guilds/${guildId}/soundboard-sounds/${soundId}`,
			body,
		);
	}

	deleteGuildSoundboardSound(guildId: string, soundId: string) {
		return this.request<void>("DELETE", `/guilds/${guildId}/soundboard-sounds/${soundId}`);
	}

	sendSoundboardSound(channelId: string, soundId: string, sourceGuildId?: string) {
		const body: DiscordRecord = { sound_id: soundId };
		if (sourceGuildId) body.source_guild_id = sourceGuildId;
		return this.request<void>("POST", `/channels/${channelId}/send-soundboard-sound`, body);
	}

	// --- Scheduled events ---

	listScheduledEvents(guildId: string, withUserCount = false) {
		return this.request<DiscordRecord[]>(
			"GET",
			`/guilds/${guildId}/scheduled-events${query({ with_user_count: withUserCount })}`,
		);
	}

	createScheduledEvent(guildId: string, body: DiscordRecord) {
		return this.request<DiscordRecord>("POST", `/guilds/${guildId}/scheduled-events`, body);
	}

	getScheduledEvent(guildId: string, eventId: string, withUserCount = false) {
		return this.request<DiscordRecord>(
			"GET",
			`/guilds/${guildId}/scheduled-events/${eventId}${query({ with_user_count: withUserCount })}`,
		);
	}

	editScheduledEvent(guildId: string, eventId: string, body: DiscordRecord) {
		return this.request<DiscordRecord>(
			"PATCH",
			`/guilds/${guildId}/scheduled-events/${eventId}`,
			body,
		);
	}

	deleteScheduledEvent(guildId: string, eventId: string) {
		return this.request<void>("DELETE", `/guilds/${guildId}/scheduled-events/${eventId}`);
	}

	listScheduledEventUsers(
		guildId: string,
		eventId: string,
		options?: { limit?: number; withMember?: boolean; before?: string; after?: string },
	) {
		return this.request<DiscordRecord[]>(
			"GET",
			`/guilds/${guildId}/scheduled-events/${eventId}/users${query({
				limit: options?.limit,
				with_member: options?.withMember,
				before: options?.before,
				after: options?.after,
			})}`,
		);
	}

	// --- Stage instances ---

	createStageInstance(body: DiscordRecord) {
		return this.request<DiscordRecord>("POST", "/stage-instances", body);
	}

	getStageInstance(channelId: string) {
		return this.request<DiscordRecord>("GET", `/stage-instances/${channelId}`);
	}

	editStageInstance(channelId: string, body: DiscordRecord) {
		return this.request<DiscordRecord>("PATCH", `/stage-instances/${channelId}`, body);
	}

	deleteStageInstance(channelId: string) {
		return this.request<void>("DELETE", `/stage-instances/${channelId}`);
	}

	// --- Auto moderation ---

	listAutoModRules(guildId: string) {
		return this.request<DiscordRecord[]>("GET", `/guilds/${guildId}/auto-moderation/rules`);
	}

	getAutoModRule(guildId: string, ruleId: string) {
		return this.request<DiscordRecord>(
			"GET",
			`/guilds/${guildId}/auto-moderation/rules/${ruleId}`,
		);
	}

	createAutoModRule(guildId: string, body: DiscordRecord) {
		return this.request<DiscordRecord>(
			"POST",
			`/guilds/${guildId}/auto-moderation/rules`,
			body,
		);
	}

	editAutoModRule(guildId: string, ruleId: string, body: DiscordRecord) {
		return this.request<DiscordRecord>(
			"PATCH",
			`/guilds/${guildId}/auto-moderation/rules/${ruleId}`,
			body,
		);
	}

	deleteAutoModRule(guildId: string, ruleId: string) {
		return this.request<void>("DELETE", `/guilds/${guildId}/auto-moderation/rules/${ruleId}`);
	}

	// --- Polls ---

	getPollAnswerVoters(
		channelId: string,
		messageId: string,
		answerId: number,
		options?: { after?: string; limit?: number },
	) {
		return this.request<DiscordRecord>(
			"GET",
			`/channels/${channelId}/polls/${messageId}/answers/${answerId}${query({
				after: options?.after,
				limit: options?.limit,
			})}`,
		);
	}

	endPoll(channelId: string, messageId: string) {
		return this.request<DiscordRecord>(
			"POST",
			`/channels/${channelId}/polls/${messageId}/expire`,
		);
	}

	// --- Voice ---

	listVoiceRegions() {
		return this.request<DiscordRecord[]>("GET", "/voice/regions");
	}

	getVoiceState(guildId: string, userId: string) {
		return this.request<DiscordRecord>("GET", `/guilds/${guildId}/voice-states/${userId}`);
	}

	modifyVoiceState(guildId: string, userId: string, body: DiscordRecord) {
		return this.request<void>("PATCH", `/guilds/${guildId}/voice-states/${userId}`, body);
	}

	modifyCurrentVoiceState(guildId: string, body: DiscordRecord) {
		return this.request<void>("PATCH", `/guilds/${guildId}/voice-states/@me`, body);
	}

	// --- Webhooks extras ---

	listGuildWebhooks(guildId: string) {
		return this.request<DiscordRecord[]>("GET", `/guilds/${guildId}/webhooks`);
	}

	getWebhook(webhookId: string, webhookToken?: string) {
		const path = webhookToken
			? `/webhooks/${webhookId}/${webhookToken}`
			: `/webhooks/${webhookId}`;
		return this.request<DiscordRecord>("GET", path);
	}

	editWebhook(webhookId: string, body: DiscordRecord, webhookToken?: string) {
		const path = webhookToken
			? `/webhooks/${webhookId}/${webhookToken}`
			: `/webhooks/${webhookId}`;
		return this.request<DiscordRecord>("PATCH", path, body);
	}

	getWebhookMessage(webhookId: string, webhookToken: string, messageId: string) {
		return this.request<DiscordRecord>(
			"GET",
			`/webhooks/${webhookId}/${webhookToken}/messages/${messageId}`,
		);
	}

	editWebhookMessage(
		webhookId: string,
		webhookToken: string,
		messageId: string,
		body: DiscordRecord,
	) {
		return this.request<DiscordRecord>(
			"PATCH",
			`/webhooks/${webhookId}/${webhookToken}/messages/${messageId}`,
			body,
		);
	}

	deleteWebhookMessage(webhookId: string, webhookToken: string, messageId: string) {
		return this.request<void>(
			"DELETE",
			`/webhooks/${webhookId}/${webhookToken}/messages/${messageId}`,
		);
	}

	// --- Templates ---

	listTemplates(guildId: string) {
		return this.request<DiscordRecord[]>("GET", `/guilds/${guildId}/templates`);
	}

	getTemplate(code: string) {
		return this.request<DiscordRecord>("GET", `/guilds/templates/${code}`);
	}

	createTemplate(guildId: string, name: string, description?: string | null) {
		return this.request<DiscordRecord>("POST", `/guilds/${guildId}/templates`, {
			name,
			description: description ?? undefined,
		});
	}

	syncTemplate(guildId: string, code: string) {
		return this.request<DiscordRecord>("PUT", `/guilds/${guildId}/templates/${code}`);
	}

	editTemplate(
		guildId: string,
		code: string,
		options: { name?: string; description?: string | null },
	) {
		return this.request<DiscordRecord>(
			"PATCH",
			`/guilds/${guildId}/templates/${code}`,
			options,
		);
	}

	deleteTemplate(guildId: string, code: string) {
		return this.request<DiscordRecord>("DELETE", `/guilds/${guildId}/templates/${code}`);
	}

	// --- Application / commands ---

	getCurrentApplication() {
		return this.request<DiscordRecord>("GET", "/applications/@me");
	}

	editCurrentApplication(body: DiscordRecord) {
		return this.request<DiscordRecord>("PATCH", "/applications/@me", body);
	}

	listApplicationCommands(applicationId: string) {
		return this.request<DiscordRecord[]>("GET", `/applications/${applicationId}/commands`);
	}

	createApplicationCommand(applicationId: string, body: DiscordRecord) {
		return this.request<DiscordRecord>("POST", `/applications/${applicationId}/commands`, body);
	}

	bulkOverwriteApplicationCommands(applicationId: string, commands: DiscordRecord[]) {
		return this.request<DiscordRecord[]>(
			"PUT",
			`/applications/${applicationId}/commands`,
			commands,
		);
	}

	getApplicationCommand(applicationId: string, commandId: string) {
		return this.request<DiscordRecord>(
			"GET",
			`/applications/${applicationId}/commands/${commandId}`,
		);
	}

	editApplicationCommand(applicationId: string, commandId: string, body: DiscordRecord) {
		return this.request<DiscordRecord>(
			"PATCH",
			`/applications/${applicationId}/commands/${commandId}`,
			body,
		);
	}

	deleteApplicationCommand(applicationId: string, commandId: string) {
		return this.request<void>("DELETE", `/applications/${applicationId}/commands/${commandId}`);
	}

	listGuildApplicationCommands(applicationId: string, guildId: string) {
		return this.request<DiscordRecord[]>(
			"GET",
			`/applications/${applicationId}/guilds/${guildId}/commands`,
		);
	}

	createGuildApplicationCommand(applicationId: string, guildId: string, body: DiscordRecord) {
		return this.request<DiscordRecord>(
			"POST",
			`/applications/${applicationId}/guilds/${guildId}/commands`,
			body,
		);
	}

	bulkOverwriteGuildApplicationCommands(
		applicationId: string,
		guildId: string,
		commands: DiscordRecord[],
	) {
		return this.request<DiscordRecord[]>(
			"PUT",
			`/applications/${applicationId}/guilds/${guildId}/commands`,
			commands,
		);
	}

	getGuildApplicationCommand(applicationId: string, guildId: string, commandId: string) {
		return this.request<DiscordRecord>(
			"GET",
			`/applications/${applicationId}/guilds/${guildId}/commands/${commandId}`,
		);
	}

	editGuildApplicationCommand(
		applicationId: string,
		guildId: string,
		commandId: string,
		body: DiscordRecord,
	) {
		return this.request<DiscordRecord>(
			"PATCH",
			`/applications/${applicationId}/guilds/${guildId}/commands/${commandId}`,
			body,
		);
	}

	deleteGuildApplicationCommand(applicationId: string, guildId: string, commandId: string) {
		return this.request<void>(
			"DELETE",
			`/applications/${applicationId}/guilds/${guildId}/commands/${commandId}`,
		);
	}

	getGuildApplicationCommandsPermissions(applicationId: string, guildId: string) {
		return this.request<DiscordRecord[]>(
			"GET",
			`/applications/${applicationId}/guilds/${guildId}/commands/permissions`,
		);
	}

	getApplicationCommandPermissions(applicationId: string, guildId: string, commandId: string) {
		return this.request<DiscordRecord>(
			"GET",
			`/applications/${applicationId}/guilds/${guildId}/commands/${commandId}/permissions`,
		);
	}

	editApplicationCommandPermissions(
		applicationId: string,
		guildId: string,
		commandId: string,
		permissions: DiscordRecord[],
	) {
		return this.request<DiscordRecord>(
			"PUT",
			`/applications/${applicationId}/guilds/${guildId}/commands/${commandId}/permissions`,
			{ permissions },
		);
	}

	listApplicationEmojis(applicationId: string) {
		return this.request<DiscordRecord>("GET", `/applications/${applicationId}/emojis`);
	}

	createApplicationEmoji(applicationId: string, options: { name: string; imageDataUri: string }) {
		return this.request<DiscordRecord>("POST", `/applications/${applicationId}/emojis`, {
			name: options.name,
			image: options.imageDataUri,
		});
	}

	getApplicationEmoji(applicationId: string, emojiId: string) {
		return this.request<DiscordRecord>(
			"GET",
			`/applications/${applicationId}/emojis/${emojiId}`,
		);
	}

	editApplicationEmoji(applicationId: string, emojiId: string, body: DiscordRecord) {
		return this.request<DiscordRecord>(
			"PATCH",
			`/applications/${applicationId}/emojis/${emojiId}`,
			body,
		);
	}

	deleteApplicationEmoji(applicationId: string, emojiId: string) {
		return this.request<void>("DELETE", `/applications/${applicationId}/emojis/${emojiId}`);
	}

	listSkus(applicationId: string) {
		return this.request<DiscordRecord[]>("GET", `/applications/${applicationId}/skus`);
	}

	listEntitlements(
		applicationId: string,
		options?: {
			userId?: string;
			skuIds?: string[];
			before?: string;
			after?: string;
			limit?: number;
			guildId?: string;
			excludeEnded?: boolean;
		},
	) {
		const params = new URLSearchParams();
		if (options?.userId) params.set("user_id", options.userId);
		if (options?.skuIds?.length) {
			for (const id of options.skuIds) params.append("sku_ids", id);
		}
		if (options?.before) params.set("before", options.before);
		if (options?.after) params.set("after", options.after);
		if (options?.limit !== undefined) params.set("limit", String(options.limit));
		if (options?.guildId) params.set("guild_id", options.guildId);
		if (options?.excludeEnded !== undefined) {
			params.set("exclude_ended", String(options.excludeEnded));
		}
		const q = params.toString();
		return this.request<DiscordRecord[]>(
			"GET",
			`/applications/${applicationId}/entitlements${q ? `?${q}` : ""}`,
		);
	}

	getEntitlement(applicationId: string, entitlementId: string) {
		return this.request<DiscordRecord>(
			"GET",
			`/applications/${applicationId}/entitlements/${entitlementId}`,
		);
	}

	createTestEntitlement(applicationId: string, body: DiscordRecord) {
		return this.request<DiscordRecord>(
			"POST",
			`/applications/${applicationId}/entitlements`,
			body,
		);
	}

	deleteTestEntitlement(applicationId: string, entitlementId: string) {
		return this.request<void>(
			"DELETE",
			`/applications/${applicationId}/entitlements/${entitlementId}`,
		);
	}

	consumeEntitlement(applicationId: string, entitlementId: string) {
		return this.request<void>(
			"POST",
			`/applications/${applicationId}/entitlements/${entitlementId}/consume`,
		);
	}

	getApplicationRoleConnectionMetadata(applicationId: string) {
		return this.request<DiscordRecord[]>(
			"GET",
			`/applications/${applicationId}/role-connections/metadata`,
		);
	}

	updateApplicationRoleConnectionMetadata(applicationId: string, metadata: DiscordRecord[]) {
		return this.request<DiscordRecord[]>(
			"PUT",
			`/applications/${applicationId}/role-connections/metadata`,
			metadata,
		);
	}

	// --- Users ---

	getUser(userId: string) {
		return this.request<DiscordRecord>("GET", `/users/${userId}`);
	}

	editCurrentUser(body: DiscordRecord) {
		return this.request<DiscordRecord>("PATCH", "/users/@me", body);
	}

	createDm(recipientId: string) {
		return this.request<DiscordRecord>("POST", "/users/@me/channels", {
			recipient_id: recipientId,
		});
	}

	// --- Interaction callback (token required from Discord) ---

	createInteractionResponse(
		interactionId: string,
		interactionToken: string,
		body: DiscordRecord,
	) {
		return this.request<DiscordRecord | void>(
			"POST",
			`/interactions/${interactionId}/${interactionToken}/callback`,
			body,
		);
	}

	getOriginalInteractionResponse(applicationId: string, interactionToken: string) {
		return this.request<DiscordRecord>(
			"GET",
			`/webhooks/${applicationId}/${interactionToken}/messages/@original`,
		);
	}

	editOriginalInteractionResponse(
		applicationId: string,
		interactionToken: string,
		body: DiscordRecord,
	) {
		return this.request<DiscordRecord>(
			"PATCH",
			`/webhooks/${applicationId}/${interactionToken}/messages/@original`,
			body,
		);
	}

	deleteOriginalInteractionResponse(applicationId: string, interactionToken: string) {
		return this.request<void>(
			"DELETE",
			`/webhooks/${applicationId}/${interactionToken}/messages/@original`,
		);
	}

	createFollowupMessage(applicationId: string, interactionToken: string, body: DiscordRecord) {
		return this.request<DiscordRecord>(
			"POST",
			`/webhooks/${applicationId}/${interactionToken}`,
			body,
		);
	}
}

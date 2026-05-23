declare namespace Cloudflare {
	interface Env {
		/** Discord bot token (preferred). */
		DISCORD_BOT_TOKEN?: string;
		/** Optional alias for DISCORD_BOT_TOKEN. */
		DISCORD_TOKEN?: string;
	}
}

interface Env {
	DISCORD_BOT_TOKEN?: string;
	DISCORD_TOKEN?: string;
}

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
	createDiscordClient,
	type DiscordClient,
	errorToolResult,
	jsonToolResult,
	resolveDiscordToken,
	textToolResult,
} from "../discord";

export type ToolEnv = {
	DISCORD_BOT_TOKEN?: string;
	DISCORD_TOKEN?: string;
};

export function clientFrom(env: ToolEnv) {
	return createDiscordClient(resolveDiscordToken(env));
}

export async function runTool(
	env: ToolEnv,
	handler: (client: DiscordClient) => Promise<string | unknown>,
) {
	try {
		const result = await handler(clientFrom(env));
		if (typeof result === "string") return textToolResult(result);
		return jsonToolResult(result);
	} catch (error) {
		return errorToolResult(error);
	}
}

export async function runToolWithArgs<T>(
	env: ToolEnv,
	args: T,
	handler: (client: DiscordClient, args: T) => Promise<string | unknown>,
) {
	try {
		const result = await handler(clientFrom(env), args);
		if (typeof result === "string") return textToolResult(result);
		return jsonToolResult(result);
	} catch (error) {
		return errorToolResult(error);
	}
}

export type ToolRegistrar = (server: McpServer, env: ToolEnv) => void;

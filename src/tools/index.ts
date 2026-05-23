import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerCoreDiscordTools } from "./core";
import { registerExtendedDiscordTools } from "./extended";
import type { ToolEnv } from "./helpers";

export type { ToolEnv } from "./helpers";

export function registerDiscordTools(server: McpServer, env: ToolEnv) {
	registerCoreDiscordTools(server, env);
	registerExtendedDiscordTools(server, env);
}

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpAgent } from "agents/mcp";
import { registerDiscordTools } from "./tools/index";

export class DiscordMCP extends McpAgent {
	server = new McpServer({
		name: "Discord MCP",
		version: "1.0.0",
	});

	async init() {
		registerDiscordTools(this.server, this.env);
	}
}

const SERVICE_INFO = {
	status: "ok",
	service: "discord-mcp-workers",
	version: "1.0.0",
	endpoints: {
		"/health": "Health check",
		"/sse": "MCP via Server-Sent Events",
		"/mcp": "Streamable HTTP MCP endpoint",
	},
};

export default {
	fetch(request: Request, env: Env, ctx: ExecutionContext) {
		const url = new URL(request.url);

		if (url.pathname === "/" || url.pathname === "/health") {
			return Response.json(SERVICE_INFO);
		}

		if (url.pathname === "/sse" || url.pathname === "/sse/message") {
			return DiscordMCP.serveSSE("/sse").fetch(request, env, ctx);
		}

		if (url.pathname === "/mcp") {
			return DiscordMCP.serve("/mcp").fetch(request, env, ctx);
		}

		return new Response(
			"Discord MCP for Cloudflare Workers\n\nEndpoints:\n- /health\n- /sse (MCP via SSE)\n- /mcp (MCP HTTP)",
			{ headers: { "content-type": "text/plain; charset=utf-8" } },
		);
	},
};

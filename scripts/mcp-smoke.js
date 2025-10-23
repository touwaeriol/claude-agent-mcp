"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_js_1 = require("@modelcontextprotocol/sdk/client/index.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/client/stdio.js");
async function main() {
    const transport = new stdio_js_1.StdioClientTransport({
        command: "node",
        args: ["dist/server.js"],
    });
    const client = new index_js_1.Client({
        name: "mcp-smoke-client",
        version: "0.1.0",
    });
    console.log("[client] Connecting to MCP server...");
    await client.connect(transport);
    console.log("[client] Connected. Server version:", client.getServerVersion());
    const toolsList = await client.listTools({});
    console.log("[client] Registered tools:", toolsList.tools.map((t) => t.name));
    console.log("[client] Creating session...");
    const createResult = await client.callTool({
    name: "claude_session_create",
        arguments: {},
    });
    const sessionInfo = createResult.structuredContent;
    const sessionId = sessionInfo.sessionId;
    console.log("[client] Session created:", sessionId);
    console.log("[client] Sending query...");
    const queryResult = await client.callTool({
        name: "claude_chat_query",
        arguments: {
            sessionId,
            prompt: "测试一下 MCP 流式回答。",
            includeThinking: true,
        },
    });
    const queryContent = queryResult.structuredContent?.finalText;
    const queryText = typeof queryContent === "string"
        ? queryContent
        : Array.isArray(queryResult.content) && queryResult.content.length > 0
            ? queryResult.content[0].text
            : undefined;
    console.log("[client] Query finalText:", queryText);
    console.log("[client] Switching model to haiku...");
    const modelResult = await client.callTool({
        name: "claude_chat_model",
        arguments: {
            sessionId,
            model: "haiku",
        },
    });
    console.log("[client] Model switch result:", modelResult.structuredContent);
    console.log("[client] Switching permission mode to plan...");
    const modeResult = await client.callTool({
        name: "claude_chat_mode",
        arguments: {
            sessionId,
            permissionMode: "plan",
        },
    });
    console.log("[client] Mode switch result:", modeResult.structuredContent);
    console.log("[client] Interrupting session...");
    const interruptResult = await client.callTool({
        name: "claude_chat_interrupt",
        arguments: {
            sessionId,
        },
    });
    console.log("[client] Interrupt response:", interruptResult.structuredContent);
    console.log("[client] Closing session...");
    const closeResult = await client.callTool({
    name: "claude_session_close",
        arguments: {
            sessionId,
        },
    });
    console.log("[client] Session close response:", closeResult.structuredContent);
    console.log("[client] Disconnecting...");
    await transport.close();
    console.log("[client] Done.");
}
main().catch((error) => {
    console.error("[client] MCP smoke test failed:", error);
    process.exit(1);
});
//# sourceMappingURL=mcp-smoke.js.map

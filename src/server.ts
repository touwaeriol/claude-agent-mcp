import { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio";

const server = new McpServer(
  {
    name: "claude-agent-mcp",
    version: "0.1.0",
  },
  {
    instructions:
      "Proxy Claude Agent SDK conversations via the claude-agent-mcp tool set.",
  }
);

server.tool("claude.chat", async () => ({
  content: [
    {
      type: "text",
      text: "Claude Agent MCP server is initialized. Tool logic will be implemented soon.",
    },
  ],
}));

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  process.on("SIGINT", async () => {
    await transport.close();
    process.exit(0);
  });
}

if (require.main === module) {
  // eslint-disable-next-line no-console
  main().catch((error) => {
    console.error("Failed to start MCP server:", error);
    process.exit(1);
  });
}

export { server };

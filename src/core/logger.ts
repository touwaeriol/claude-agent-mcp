import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { ClaudeSessionState, LoggingLevel, SendLog } from "./types.js";

const errorLevels = new Set<LoggingLevel>([
  "error",
  "critical",
  "alert",
  "emergency",
]);

const warnLevels = new Set<LoggingLevel>(["warning", "notice"]);

export function createSendLog(server: McpServer): SendLog {
  return async (
    session: ClaudeSessionState | undefined,
    level: LoggingLevel,
    message: string
  ): Promise<void> => {
    if (!server.server || typeof server.server.sendLoggingMessage !== "function") {
      if (errorLevels.has(level)) {
        // eslint-disable-next-line no-console
        console.error(`[${level}] ${message}`);
        return;
      }
      if (warnLevels.has(level)) {
        // eslint-disable-next-line no-console
        console.warn(`[${level}] ${message}`);
        return;
      }
      // eslint-disable-next-line no-console
      console.debug(`[${level}] ${message}`);
      return;
    }

    await server.server.sendLoggingMessage(
      {
        level,
        data: message,
      },
      session?.sessionId
    );
  };
}

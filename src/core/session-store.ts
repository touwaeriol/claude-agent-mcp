import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";

import type { ClaudeSessionState } from "./types.js";

export class SessionStore {
  #sessions = new Map<string, ClaudeSessionState>();

  add(session: ClaudeSessionState): void {
    this.#sessions.set(session.sessionId, session);
  }

  get(sessionId: string): ClaudeSessionState | undefined {
    return this.#sessions.get(sessionId);
  }

  ensure(sessionId: string): ClaudeSessionState {
    const session = this.#sessions.get(sessionId);
    if (!session) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Session ${sessionId} does not exist or is closed.`
      );
    }
    if (session.closed) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Session ${sessionId} is closed.`
      );
    }
    return session;
  }

  remove(sessionId: string): void {
    this.#sessions.delete(sessionId);
  }

  list(): ClaudeSessionState[] {
    return [...this.#sessions.values()];
  }

  get size(): number {
    return this.#sessions.size;
  }
}

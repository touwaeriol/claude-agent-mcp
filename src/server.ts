import { randomUUID } from "node:crypto";

import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ClaudeAgentSDKClient } from "claude-agent-sdk-ts";

import {
  closeSessionArgs,
  createSessionArgs,
  directQueryArgs,
  interruptArgs,
  listSessionsArgs,
  modeArgs,
  modelArgs,
  queryArgs,
  serverConfigArgs,
  sessionStatusArgs,
} from "./core/schemas.js";
import { MessagePump } from "./core/message-pump.js";
import { createSendLog } from "./core/logger.js";
import { SessionStore } from "./core/session-store.js";
import type {
  ClaudeSessionState,
  PendingQuery,
  SessionSummary,
} from "./core/types.js";

function toNullable(value?: string): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

const server = new McpServer(
  {
    name: "claude-agent-mcp",
    version: "1.1.2",
  },
  {
    instructions:
      "Proxy Claude Agent SDK conversations via the claude-agent-mcp tool set.",
    capabilities: {
      logging: {},
    },
  }
);

const sendLog = createSendLog(server);
const sessionStore = new SessionStore();
let modelUpdateTimeoutMs = 10000;

function summarizeSession(session: ClaudeSessionState): SessionSummary {
  return {
    sessionId: session.sessionId,
    model: session.options.model ?? null,
    permissionMode: session.options.permissionMode ?? null,
    cwd: session.options.cwd ?? null,
    createdAt: session.createdAt.toISOString(),
    activeQueries: session.pendingQueries.length,
    closed: session.closed,
  };
}

function createSessionToolResult(
  session: ClaudeSessionState,
  reused: boolean
): CallToolResult {
  return {
    content: [
      {
        type: "text",
        text: reused
          ? `Claude session active: ${session.sessionId}`
          : `Claude session created: ${session.sessionId}`,
      },
    ],
    structuredContent: {
      sessionId: session.sessionId,
      model: session.options.model,
      cwd: session.options.cwd,
      permissionMode: session.options.permissionMode,
      systemPrompt: session.options.systemPrompt,
      active: !session.closed,
      createdAt: session.createdAt.toISOString(),
      reused,
    },
  };
}

async function shutdownSession(sessionId: string): Promise<void> {
  const session = sessionStore.get(sessionId);
  if (!session) {
    return;
  }
  if (session.closed) {
    sessionStore.remove(sessionId);
    return;
  }

  session.closed = true;
  await sendLog(session, "info", `Closing session ${sessionId}.`);
  sessionStore.remove(sessionId);

  const pending = [...session.pendingQueries];
  session.pendingQueries.length = 0;
  for (const tracker of pending) {
    if (!tracker.completed) {
      tracker.completed = true;
      tracker.reject(new Error("Session closed, query interrupted."));
    }
  }

  const waiters = [...session.modelWaiters];
  session.modelWaiters.length = 0;
  for (const waiter of waiters) {
    waiter(session.options.model ?? null);
  }

  try {
    await session.client.disconnect();
  } catch (error) {
    await sendLog(
      session,
      "warning",
      `Error disconnecting session ${sessionId}: ${(error as Error).message}`
    );
  }
}

const messagePump = new MessagePump({ sendLog, shutdownSession });

async function closeAllSessions(): Promise<void> {
  const active = sessionStore.list();
  if (active.length === 0) {
    return;
  }
  await Promise.all(
    active.map(async (session) => {
      try {
        await shutdownSession(session.sessionId);
      } catch (error) {
        await sendLog(
          session,
          "warning",
          `Failed to shutdown session ${session.sessionId}: ${(
            error as Error
          ).message}`
        );
      }
    })
  );
}

function ensureSession(sessionId: string): ClaudeSessionState {
  return sessionStore.ensure(sessionId);
}

server.tool("claude_session_create", createSessionArgs, async (args) => {
  const requestedSessionId = toNullable(args.sessionId);
  const requestedCwd = toNullable(args.cwd);
  const requestedModel = toNullable(args.model);
  const requestedSystemPrompt = toNullable(args.systemPrompt);
  const requestedPermissionMode = args.permissionMode;

  if (requestedSessionId) {
    const existing = sessionStore.get(requestedSessionId);
    if (!existing || existing.closed) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Session ${requestedSessionId} does not exist or is closed. Omit sessionId to create a new session.`
      );
    }

    if (
      (requestedCwd !== undefined && requestedCwd !== existing.options.cwd) ||
      (requestedModel !== undefined && requestedModel !== existing.options.model) ||
      (requestedSystemPrompt !== undefined &&
        requestedSystemPrompt !== existing.options.systemPrompt) ||
      (requestedPermissionMode !== undefined &&
        requestedPermissionMode !== existing.options.permissionMode)
    ) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Cannot override options when reusing session ${requestedSessionId}.`
      );
    }

    await sendLog(existing, "info", `Session ${requestedSessionId} reused.`);
    return createSessionToolResult(existing, true);
  }

  const sessionId = randomUUID();
  const clientOptions = {
    cwd: requestedCwd ?? null,
    model: requestedModel ?? null,
    permissionMode: requestedPermissionMode ?? null,
    systemPrompt: requestedSystemPrompt ?? null,
    includePartialMessages: true,
  } satisfies ConstructorParameters<typeof ClaudeAgentSDKClient>[0];

  const client = new ClaudeAgentSDKClient(clientOptions);
  try {
    await client.connect();
  } catch (error) {
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to create Claude session: ${(error as Error).message}`
    );
  }

  const session: ClaudeSessionState = {
    sessionId,
    client,
    options: {
      cwd: clientOptions.cwd,
      model: clientOptions.model,
      permissionMode: clientOptions.permissionMode,
      systemPrompt: clientOptions.systemPrompt,
    },
    createdAt: new Date(),
    pendingQueries: [],
    closed: false,
    modelWaiters: [],
  };

  sessionStore.add(session);
  messagePump.start(session);
  await sendLog(session, "info", `Session ${sessionId} created.`);

  return createSessionToolResult(session, false);
});

server.tool("claude_session_close", closeSessionArgs, async ({ sessionId }) => {
  const session = sessionStore.get(sessionId);
  if (!session || session.closed) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Session ${sessionId} does not exist or is closed.`
    );
  }

  await shutdownSession(sessionId);
  await sendLog(undefined, "info", `Session ${sessionId} closed.`);

  return {
    content: [
      {
        type: "text",
        text: `Session ${sessionId} closed.`,
      },
    ],
    structuredContent: {
      sessionId,
      activeSessions: sessionStore.size,
    },
  } satisfies CallToolResult;
});

server.tool("claude_session_list", listSessionsArgs, async () => {
  const sessions = sessionStore.list().map(summarizeSession);
  const text =
    sessions.length === 0
      ? "No active Claude sessions."
      : sessions
          .map(
            (item) =>
              `${item.sessionId} | model: ${item.model ?? "unknown"} | pending: ${item.activeQueries}`
          )
          .join("\n");

  return {
    content: [
      {
        type: "text",
        text,
      },
    ],
    structuredContent: {
      total: sessions.length,
      sessions,
    },
  } satisfies CallToolResult;
});

server.tool(
  "claude_session_status",
  sessionStatusArgs,
  async ({ sessionId }) => {
    const session = ensureSession(sessionId);
    const summary = summarizeSession(session);
    const pendingDetails = session.pendingQueries.map((tracker, index) => ({
      index,
      includeThinking: tracker.includeThinking,
      closeAfter: tracker.closeAfter,
      completed: tracker.completed,
      toolInvocationCount: tracker.toolInvocations.length,
      collectedTextChunks: tracker.finalTextChunks.length,
    }));

    return {
      content: [
        {
          type: "text",
          text: `Session ${sessionId} has ${pendingDetails.length} pending queries.`,
        },
      ],
      structuredContent: {
        session: summary,
        pendingQueries: pendingDetails,
        waitingModelListeners: session.modelWaiters.length,
      },
    } satisfies CallToolResult;
  }
);

server.tool("claude_server_config", serverConfigArgs, async (args) => {
  if (typeof args.modelUpdateTimeoutMs === "number") {
    modelUpdateTimeoutMs = args.modelUpdateTimeoutMs;
    await sendLog(
      undefined,
      "notice",
      `Model update timeout set to ${modelUpdateTimeoutMs}ms.`
    );
  }

  return {
    content: [
      {
        type: "text",
        text: `Model update timeout: ${modelUpdateTimeoutMs}ms.`,
      },
    ],
    structuredContent: {
      modelUpdateTimeoutMs,
    },
  } satisfies CallToolResult;
});

server.tool("claude_chat_query", queryArgs, async (args) => {
  const session = ensureSession(args.sessionId);
  messagePump.ensureNoConcurrentQuery(session);

  return await new Promise<CallToolResult>((resolve, reject) => {
    const tracker: PendingQuery = {
      includeThinking: Boolean(args.includeThinking),
      closeAfter: Boolean(args.closeAfter),
      resolve,
      reject,
      finalTextChunks: [],
      thinkingChunks: [],
      toolInvocations: [],
      toolInvocationMap: new Map(),
      completed: false,
    };

    session.pendingQueries.push(tracker);

    session.client
      .query(args.prompt, session.sessionId)
      .then(() => {
        void sendLog(
          session,
          "debug",
          `Session ${session.sessionId} prompt dispatched.`
        );
      })
      .catch((error) => {
        const index = session.pendingQueries.indexOf(tracker);
        if (index !== -1) {
          session.pendingQueries.splice(index, 1);
        }
        reject(error instanceof Error ? error : new Error(String(error)));
      });
  });
});

server.tool("claude_chat_interrupt", interruptArgs, async ({ sessionId }) => {
  const session = ensureSession(sessionId);
  await session.client.interrupt();
  await sendLog(session, "warning", `Session ${sessionId} interrupt requested.`);

  return {
    content: [
      {
        type: "text",
        text: `Session ${sessionId} interrupt requested.`,
      },
    ],
    structuredContent: {
      interrupted: true,
      sessionId,
    },
  } satisfies CallToolResult;
});

server.tool("claude_chat_model", modelArgs, async ({ sessionId, model }) => {
  const session = ensureSession(sessionId);
  const pendingModel = messagePump.waitForModelUpdate(
    session,
    modelUpdateTimeoutMs
  );
  await session.client.setModel(model);
  const resolvedModel = await pendingModel;
  session.options.model = resolvedModel ?? session.options.model ?? model;

  await sendLog(
    session,
    "info",
    `Session ${sessionId} model switched to ${resolvedModel ?? model}.`
  );

  return {
    content: [
      {
        type: "text",
        text: `Model switched to ${resolvedModel ?? model}.`,
      },
    ],
    structuredContent: {
      sessionId,
      requestedModel: model,
      resolvedModel: resolvedModel ?? null,
    },
  } satisfies CallToolResult;
});

server.tool("claude_chat_mode", modeArgs, async ({ sessionId, permissionMode }) => {
  const session = ensureSession(sessionId);
  await session.client.setPermissionMode(permissionMode);
  session.options.permissionMode = permissionMode;
  await sendLog(
    session,
    "info",
    `Session ${sessionId} permission mode switched to ${permissionMode}.`
  );

  return {
    content: [
      {
        type: "text",
        text: `Permission mode switched to ${permissionMode}.`,
      },
    ],
    structuredContent: {
      sessionId,
      permissionMode,
    },
  } satisfies CallToolResult;
});

server.tool("claude_direct_query", directQueryArgs, async (args) => {
  const sessionId = randomUUID();
  const clientOptions = {
    cwd: toNullable(args.cwd) ?? null,
    model: toNullable(args.model) ?? null,
    permissionMode: args.permissionMode ?? null,
    systemPrompt: toNullable(args.systemPrompt) ?? null,
    includePartialMessages: true,
  } satisfies ConstructorParameters<typeof ClaudeAgentSDKClient>[0];

  const client = new ClaudeAgentSDKClient(clientOptions);
  try {
    await client.connect();
  } catch (error) {
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to create Claude session: ${(error as Error).message}`
    );
  }

  const session: ClaudeSessionState = {
    sessionId,
    client,
    options: {
      cwd: clientOptions.cwd,
      model: clientOptions.model,
      permissionMode: clientOptions.permissionMode,
      systemPrompt: clientOptions.systemPrompt,
    },
    createdAt: new Date(),
    pendingQueries: [],
    closed: false,
    modelWaiters: [],
  };

  sessionStore.add(session);
  messagePump.start(session);
  await sendLog(session, "info", `Direct query session ${sessionId} created.`);

  return await new Promise<CallToolResult>((resolve, reject) => {
    const tracker: PendingQuery = {
      includeThinking: Boolean(args.includeThinking),
      closeAfter: true,
      resolve: async (result: CallToolResult) => {
        await shutdownSession(sessionId);
        resolve(result);
      },
      reject,
      finalTextChunks: [],
      thinkingChunks: [],
      toolInvocations: [],
      toolInvocationMap: new Map(),
      completed: false,
    };

    session.pendingQueries.push(tracker);

    session.client
      .query(args.prompt, session.sessionId)
      .then(() => {
        void sendLog(
          session,
          "debug",
          `Direct query session ${session.sessionId} sent prompt.`
        );
      })
      .catch(async (error) => {
        try {
          await shutdownSession(sessionId);
        } catch (shutdownError) {
          await sendLog(
            session,
            "warning",
            `Failed to shutdown session ${sessionId}: ${(
              shutdownError as Error
            ).message}`
          );
        }
        reject(error instanceof Error ? error : new Error(String(error)));
      });
  });
});

export async function startServer(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  process.on("SIGINT", async () => {
    await closeAllSessions();
    await transport.close();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    await closeAllSessions();
    await transport.close();
    process.exit(0);
  });
}

if (require.main === module) {
  // eslint-disable-next-line no-console
  startServer().catch((error) => {
    console.error("Failed to start MCP server:", error);
    process.exit(1);
  });
}

export { server };

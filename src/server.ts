import { randomUUID } from "node:crypto";

import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ClaudeAgentSDKClient, PermissionMode } from "claude-agent-sdk-ts";
import { z } from "zod";

type LoggingLevel =
  | "debug"
  | "info"
  | "notice"
  | "warning"
  | "error"
  | "critical"
  | "alert"
  | "emergency";

type ClaudeStreamMessage = Record<string, unknown> & {
  type?: string;
  session_id?: string;
};

interface ToolInvocationRecord {
  id: string;
  name?: string;
  input?: unknown;
  output?: unknown;
  success?: boolean;
  error?: string | null;
}

interface PendingQuery {
  includeThinking: boolean;
  closeAfter: boolean;
  resolve: (result: CallToolResult) => void;
  reject: (error: Error) => void;
  finalTextChunks: string[];
  thinkingChunks: string[];
  toolInvocations: ToolInvocationRecord[];
  toolInvocationMap: Map<string, ToolInvocationRecord>;
  metadata?: Record<string, unknown>;
  completed: boolean;
}

interface ClaudeSessionState {
  sessionId: string;
  client: ClaudeAgentSDKClient;
  options: {
    cwd?: string | null;
    model?: string | null;
    permissionMode?: PermissionMode | null;
    systemPrompt?: string | null;
  };
  createdAt: Date;
  pendingQueries: PendingQuery[];
  messageLoop?: Promise<void>;
  closed: boolean;
  modelWaiters: Array<(value: string | null) => void>;
}

const sessions = new Map<string, ClaudeSessionState>();

const permissionModeSchema = z.enum([
  "default",
  "acceptEdits",
  "plan",
  "bypassPermissions",
]);

const createSessionArgs = {
  cwd: z.string().min(1).optional(),
  model: z.string().min(1).optional(),
  permissionMode: permissionModeSchema.optional(),
  systemPrompt: z.string().min(1).optional(),
} satisfies z.ZodRawShape;
const createSessionSchema = z.object(createSessionArgs);

const closeSessionArgs = {
  sessionId: z.string().min(1),
} satisfies z.ZodRawShape;
const closeSessionSchema = z.object(closeSessionArgs);

const queryArgs = {
  sessionId: z.string().min(1),
  prompt: z.string(),
  closeAfter: z.boolean().optional(),
  includeThinking: z.boolean().optional(),
} satisfies z.ZodRawShape;
const querySchema = z.object(queryArgs);

const interruptArgs = {
  sessionId: z.string().min(1),
} satisfies z.ZodRawShape;
const interruptSchema = z.object(interruptArgs);

const modelArgs = {
  sessionId: z.string().min(1),
  model: z.string().min(1),
} satisfies z.ZodRawShape;
const modelSchema = z.object(modelArgs);

const modeArgs = {
  sessionId: z.string().min(1),
  permissionMode: permissionModeSchema,
} satisfies z.ZodRawShape;
const modeSchema = z.object(modeArgs);

function toNullable(value?: string): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

async function sendLog(
  session: ClaudeSessionState | undefined,
  level: LoggingLevel,
  message: string
): Promise<void> {
  const params = {
    level,
    message,
  } as const;
  await server.server.sendLoggingMessage(params, session?.sessionId);
}

function ensureSession(sessionId: string): ClaudeSessionState {
  const session = sessions.get(sessionId);
  if (!session) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Session ${sessionId} does not exist or is closed.`
    );
  }
  if (session.closed) {
    throw new McpError(ErrorCode.InvalidParams, `Session ${sessionId} is closed.`);
  }
  return session;
}

async function shutdownSession(sessionId: string): Promise<void> {
  const session = sessions.get(sessionId);
  if (!session) {
    return;
  }
  if (session.closed) {
    sessions.delete(sessionId);
    return;
  }
  session.closed = true;
  await sendLog(session, "info", `Closing session ${sessionId}.`);
  sessions.delete(sessionId);

  const pending = [...session.pendingQueries];
  session.pendingQueries.length = 0;
  for (const tracker of pending) {
    if (!tracker.completed) {
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

function startMessagePump(session: ClaudeSessionState): void {
  if (session.messageLoop) {
    return;
  }

  session.messageLoop = (async () => {
    try {
      for await (const rawMessage of session.client.receiveMessages()) {
        if (session.closed) {
          break;
        }
        await handleStreamMessage(session, rawMessage as ClaudeStreamMessage);
      }
    } catch (error) {
      await sendLog(
        session,
        "error",
        `Session ${session.sessionId} stream error: ${(error as Error).message}`
      );
      const pending = [...session.pendingQueries];
      session.pendingQueries.length = 0;
      for (const tracker of pending) {
        if (!tracker.completed) {
          tracker.reject(
            error instanceof Error ? error : new Error(String(error))
          );
        }
      }
      const waiters = [...session.modelWaiters];
      session.modelWaiters.length = 0;
      for (const waiter of waiters) {
        waiter(session.options.model ?? null);
      }
      sessions.delete(session.sessionId);
      session.closed = true;
    }
  })();
}

function getActiveTracker(
  session: ClaudeSessionState
): PendingQuery | undefined {
  return session.pendingQueries[0];
}

function ensureNoConcurrentQuery(session: ClaudeSessionState): void {
  const active = getActiveTracker(session);
  if (active && !active.completed) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Session ${session.sessionId} is processing, concurrent queries not supported.`
    );
  }
}

function extractTextFromContent(content: unknown[]): string[] {
  const texts: string[] = [];
  for (const block of content) {
    if (
      block &&
      typeof block === "object" &&
      "type" in block &&
      (block as { type: string }).type === "text" &&
      "text" in block
    ) {
      const text = String((block as { text: unknown }).text ?? "");
      if (text.length > 0) {
        texts.push(text);
      }
    }
  }
  return texts;
}

function extractThinkingFromContent(content: unknown[]): string[] {
  const chunks: string[] = [];
  for (const block of content) {
    if (
      block &&
      typeof block === "object" &&
      "type" in block &&
      (block as { type: string }).type === "thinking" &&
      "text" in block
    ) {
      const text = String((block as { text: unknown }).text ?? "");
      if (text.length > 0) {
        chunks.push(text);
      }
    }
  }
  return chunks;
}

function waitForModelUpdate(
  session: ClaudeSessionState,
  timeoutMs = 10000
): Promise<string | null> {
  return new Promise((resolve) => {
    const handler = (value: string | null): void => {
      cleanup();
      resolve(value);
    };
    const cleanup = (): void => {
      clearTimeout(timer);
      const index = session.modelWaiters.indexOf(handler);
      if (index !== -1) {
        session.modelWaiters.splice(index, 1);
      }
    };
    const timer = setTimeout(() => {
      cleanup();
      resolve(session.options.model ?? null);
    }, timeoutMs);

    session.modelWaiters.push(handler);
  });
}

function registerToolUse(
  tracker: PendingQuery | undefined,
  block: Record<string, unknown>,
  session: ClaudeSessionState
): void {
  if (!tracker) {
    return;
  }
  const id = typeof block.id === "string" ? block.id : randomUUID();
  const record: ToolInvocationRecord = { id };
  if (typeof block.name === "string" && block.name.length > 0) {
    record.name = block.name;
  }
  if ("input" in block && (block as { input?: unknown }).input !== undefined) {
    record.input = (block as { input?: unknown }).input;
  }
  tracker.toolInvocationMap.set(id, record);
  tracker.toolInvocations.push(record);
  void sendLog(
    session,
    "debug",
    `Session ${session.sessionId} tool invocation: ${record.name ?? "<unknown>"}`
  );
}

function registerToolResult(
  tracker: PendingQuery | undefined,
  block: Record<string, unknown>
): void {
  if (!tracker) {
    return;
  }
  const toolUseId =
    typeof block.tool_use_id === "string" ? block.tool_use_id : undefined;
  const record = toolUseId
    ? tracker.toolInvocationMap.get(toolUseId)
    : undefined;
  const target: ToolInvocationRecord =
    record ?? {
      id: toolUseId ?? randomUUID(),
    };
  if (!record) {
    tracker.toolInvocationMap.set(target.id, target);
    tracker.toolInvocations.push(target);
  }
  if ("is_error" in block) {
    const isError = (block as { is_error?: unknown }).is_error;
    if (typeof isError === "boolean") {
      target.success = !isError;
    }
  }
  if ("error" in block) {
    const errValue = (block as { error?: unknown }).error;
    if (typeof errValue === "string") {
      target.error = errValue;
    }
  }
  if ("content" in block) {
    const output = (block as { content?: unknown }).content;
    if (output !== undefined) {
      target.output = output;
    }
  }
}

async function handleStreamMessage(
  session: ClaudeSessionState,
  message: ClaudeStreamMessage
): Promise<void> {
  const type = typeof message.type === "string" ? message.type : "";
  const tracker = getActiveTracker(session);

  if (type === "system") {
    await sendLog(
      session,
      "debug",
      `Session ${session.sessionId} system event: ${JSON.stringify(message)}`
    );
    const model = message.model;
    if (typeof model === "string") {
      session.options.model = model;
      if (session.modelWaiters.length > 0) {
        const waiters = [...session.modelWaiters];
        session.modelWaiters.length = 0;
        for (const waiter of waiters) {
          waiter(model);
        }
      }
    }
    const permissionMode = message.permissionMode;
    if (
      typeof permissionMode === "string" &&
      permissionModeSchema.options.includes(permissionMode as PermissionMode)
    ) {
      session.options.permissionMode = permissionMode as PermissionMode;
    }
    return;
  }

  if (type === "assistant" && message.message && typeof message.message === "object") {
    const assistantMessage = message.message as Record<string, unknown>;
    const content = Array.isArray(assistantMessage.content)
      ? (assistantMessage.content as unknown[])
      : [];
    const textChunks = extractTextFromContent(content);
    if (tracker && textChunks.length > 0) {
      tracker.finalTextChunks.push(...textChunks);
    }
    if (tracker && tracker.includeThinking) {
      tracker.thinkingChunks.push(...extractThinkingFromContent(content));
    }
    for (const block of content) {
      if (
        block &&
        typeof block === "object" &&
        "type" in block &&
        (block as { type: string }).type === "tool_use"
      ) {
        registerToolUse(
          tracker,
          block as Record<string, unknown>,
          session
        );
      }
    }
    if (textChunks.length > 0) {
      await sendLog(
        session,
        "info",
        textChunks.join("")
      );
    } else {
      await sendLog(
        session,
        "debug",
        `Session ${session.sessionId} assistant message: ${JSON.stringify(
          assistantMessage
        )}`
      );
    }
    return;
  }

  if (type === "user" && message.message && typeof message.message === "object") {
    const userMessage = message.message as Record<string, unknown>;
    const content = Array.isArray(userMessage.content)
      ? (userMessage.content as unknown[])
      : [];
    for (const block of content) {
      if (
        block &&
        typeof block === "object" &&
        "type" in block &&
        (block as { type: string }).type === "tool_result"
      ) {
        registerToolResult(tracker, block as Record<string, unknown>);
      }
    }
    await sendLog(
      session,
      "debug",
      `Session ${session.sessionId} tool result: ${JSON.stringify(userMessage)}`
    );
    return;
  }

  if (type === "result") {
    if (!tracker) {
      await sendLog(
        session,
        "warning",
        `收到结果消息但无挂起查询：${JSON.stringify(message)}`
      );
      return;
    }
    tracker.completed = true;
    const subtype = typeof message.subtype === "string" ? message.subtype : "";
    if (typeof message.result === "string" && message.result.length > 0) {
      tracker.finalTextChunks.push(message.result);
    }
    tracker.metadata = {
      subtype,
      durationMs: message.duration_ms,
      durationApiMs: message.duration_api_ms,
      numTurns: message.num_turns,
      usage: message.usage,
      totalCostUsd: message.total_cost_usd,
      modelUsage: message.modelUsage,
      permissionDenials: message.permission_denials,
    };

    const action = (): void => {
      const resultText = tracker.finalTextChunks.join("").trim();
      const toolInvocations = tracker.toolInvocations.map((item) => ({
        id: item.id,
        name: item.name,
        input: item.input,
        output: item.output,
        success: item.success,
        error: item.error,
      }));

      const structuredContent: Record<string, unknown> = {
        finalText: resultText,
        toolInvocations,
        sessionId: session.sessionId,
        metadata: tracker.metadata ?? {},
      };
      if (tracker.includeThinking) {
        structuredContent.thinking = tracker.thinkingChunks;
      }

      const response: CallToolResult = {
        content: [
          {
            type: "text",
            text:
              resultText.length > 0
                ? resultText
                : "Claude 查询已完成，详见 structuredContent。",
          },
        ],
        structuredContent,
      };

      const index = session.pendingQueries.indexOf(tracker);
      if (index !== -1) {
        session.pendingQueries.splice(index, 1);
      }

      tracker.resolve(response);

      if (tracker.closeAfter) {
        void shutdownSession(session.sessionId);
      }
    };

    if (subtype === "error" || message.is_error === true) {
      const errorField = (message as { error?: unknown }).error;
      const errorMessage =
        typeof errorField === "string"
          ? errorField
          : "Claude 查询执行失败。";
      const error = new Error(errorMessage);
      tracker.reject(error);
      const index = session.pendingQueries.indexOf(tracker);
      if (index !== -1) {
        session.pendingQueries.splice(index, 1);
      }
      await sendLog(session, "error", errorMessage);
      return;
    }

    action();
    await sendLog(
      session,
      "info",
      `Session ${session.sessionId} query completed.`
    );
    return;
  }

  if (type === "error") {
    await sendLog(
      session,
      "error",
      `Claude CLI error: ${JSON.stringify(message)}`
    );
    if (tracker && !tracker.completed) {
      tracker.reject(new Error("Claude CLI returned error."));
      const index = session.pendingQueries.indexOf(tracker);
      if (index !== -1) {
        session.pendingQueries.splice(index, 1);
      }
    }
    return;
  }

  await sendLog(
    session,
    "debug",
    `Session ${session.sessionId} received unclassified message: ${JSON.stringify(message)}`
  );
}

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

server.tool("claude_session_create", createSessionArgs, async (args) => {
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

  sessions.set(sessionId, session);
  startMessagePump(session);
  await sendLog(session, "info", `Session ${sessionId} created.`);

  const response: CallToolResult = {
    content: [
      {
        type: "text",
        text: `Claude session created: ${sessionId}`,
      },
    ],
    structuredContent: {
      sessionId,
      model: session.options.model,
      cwd: session.options.cwd,
      permissionMode: session.options.permissionMode,
      systemPrompt: session.options.systemPrompt,
      active: true,
      createdAt: session.createdAt.toISOString(),
    },
  };
  return response;
});

server.tool("claude_session_close", closeSessionArgs, async ({ sessionId }) => {
  const session = sessions.get(sessionId);
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
      activeSessions: sessions.size,
    },
  } satisfies CallToolResult;
});

server.tool("claude_chat_query", queryArgs, async (args) => {
  const session = ensureSession(args.sessionId);
  ensureNoConcurrentQuery(session);

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
          `会话 ${session.sessionId} 已发送提示信息。`
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
  const pending = waitForModelUpdate(session);
  await session.client.setModel(model);
  const resolvedModel = await pending;
  session.options.model = resolvedModel ?? session.options.model ?? model;

  await sendLog(
    session,
    "info",
    `Session ${sessionId} model switched to ${resolvedModel ?? model} (requested: ${model}).`
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

export async function startServer(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  process.on("SIGINT", async () => {
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

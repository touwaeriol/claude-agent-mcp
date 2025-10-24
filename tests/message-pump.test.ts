import { describe, expect, it, jest } from "@jest/globals";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

import { MessagePump } from "../src/core/message-pump.js";
import type {
  ClaudeSessionState,
  PendingQuery,
} from "../src/core/types.js";

function createSession(overrides: Partial<ClaudeSessionState> = {}): ClaudeSessionState {
  const baseClient = {
    receiveMessages: async function* (): AsyncGenerator<unknown> {
      // Placeholder generator, individual tests override as needed.
    },
    disconnect: jest.fn().mockResolvedValue(undefined),
  };

  return {
    sessionId: "session-test",
    client: baseClient as unknown as ClaudeSessionState["client"],
    options: {
      cwd: null,
      model: null,
      permissionMode: null,
      systemPrompt: null,
    },
    createdAt: new Date("2024-01-01T00:00:00Z"),
    pendingQueries: [],
    closed: false,
    modelWaiters: [],
    ...overrides,
  } satisfies ClaudeSessionState;
}

function createTracker(overrides: Partial<PendingQuery> = {}): PendingQuery {
  const tracker: PendingQuery = {
    includeThinking: false,
    closeAfter: false,
    resolve: () => undefined,
    reject: () => undefined,
    finalTextChunks: [],
    thinkingChunks: [],
    toolInvocations: [],
    toolInvocationMap: new Map(),
    metadata: undefined,
    completed: false,
    ...overrides,
  };
  return tracker;
}

describe("MessagePump", () => {
  it("汇总结果并在 closeAfter 时触发会话关闭", async () => {
    const sendLog = jest
      .fn(async () => undefined)
      .mockName("sendLog");
    const shutdownSession = jest.fn().mockResolvedValue(undefined);
    const messagePump = new MessagePump({ sendLog, shutdownSession });

    const messages = [
      {
        type: "assistant",
        message: {
          content: [
            {
              type: "text",
              text: "Hello ",
            },
          ],
        },
      },
      {
        type: "result",
        result: "world",
      },
    ];

    const client = {
      receiveMessages: jest.fn(async function* () {
        for (const message of messages) {
          yield message;
        }
      }),
      disconnect: jest.fn().mockResolvedValue(undefined),
    };

    const session = createSession({
      sessionId: "session-close",
      client: client as unknown as ClaudeSessionState["client"],
    });

    let resolveResult: (result: CallToolResult) => void = () => undefined;
    const resultPromise = new Promise<CallToolResult>((resolve) => {
      resolveResult = resolve;
    });

    const tracker = createTracker({
      includeThinking: false,
      closeAfter: true,
      resolve: async (result) => {
        resolveResult(result);
      },
      reject: jest.fn(),
    });
    session.pendingQueries.push(tracker);

    messagePump.start(session);

    const result = await resultPromise;
    await session.messageLoop;

    expect(result.structuredContent).toBeDefined();
    expect((result.structuredContent as Record<string, unknown>).finalText).toBe(
      "Hello world"
    );
    expect(tracker.completed).toBe(true);
    expect(shutdownSession).toHaveBeenCalledWith("session-close");
    expect(sendLog).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: "session-close" }),
      "info",
      "Session session-close query completed."
    );
  });

  it("在模型更新时解析等待队列", async () => {
    const messagePump = new MessagePump({
      sendLog: async () => undefined,
      shutdownSession: async () => undefined,
    });

    const session = createSession();
    const waiter = messagePump.waitForModelUpdate(session, 50);

    expect(session.modelWaiters).toHaveLength(1);

    session.modelWaiters[0]("claude-3-sonnet");
    const resolved = await waiter;
    expect(resolved).toBe("claude-3-sonnet");
    expect(session.modelWaiters).toHaveLength(0);
  });

  it("流错误时触发关闭并记录警告", async () => {
    const shutdownSession = jest.fn(async () => undefined);
    const sendLog = jest.fn(async () => undefined);
    const messagePump = new MessagePump({ sendLog, shutdownSession });

    const client = {
      receiveMessages: jest.fn(async function* () {
        throw new Error("stream broken");
      }),
      disconnect: jest.fn().mockResolvedValue(undefined),
    };

    const tracker = createTracker({
      reject: jest.fn(),
    });

    const session = createSession({
      sessionId: "session-error",
      client: client as unknown as ClaudeSessionState["client"],
      pendingQueries: [tracker],
    });

    messagePump.start(session);
    await session.messageLoop;

    expect(sendLog).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: "session-error" }),
      "error",
      expect.stringContaining("stream broken")
    );
    expect(shutdownSession).toHaveBeenCalledWith("session-error");
  });
});

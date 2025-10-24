import { randomUUID } from "node:crypto";

import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";

import { permissionModeSchema } from "./schemas.js";
import type {
  ClaudeSessionState,
  ClaudeStreamMessage,
  PendingQuery,
  SendLog,
  ToolInvocationRecord,
} from "./types.js";

export interface MessagePumpDeps {
  sendLog: SendLog;
  shutdownSession: (sessionId: string) => Promise<void>;
}

export class MessagePump {
  readonly #sendLog: SendLog;
  readonly #shutdownSession: (sessionId: string) => Promise<void>;

  constructor(deps: MessagePumpDeps) {
    this.#sendLog = deps.sendLog;
    this.#shutdownSession = deps.shutdownSession;
  }

  start(session: ClaudeSessionState): void {
    if (session.messageLoop) {
      return;
    }

    session.messageLoop = (async () => {
      try {
        for await (const rawMessage of session.client.receiveMessages()) {
          if (session.closed) {
            break;
          }
          await this.#handleStreamMessage(
            session,
            rawMessage as ClaudeStreamMessage
          );
        }
      } catch (error) {
        await this.#sendLog(
          session,
          "error",
          `Session ${session.sessionId} stream error: ${(error as Error).message}`
        );
        try {
          await this.#shutdownSession(session.sessionId);
        } catch (shutdownError) {
          await this.#sendLog(
            session,
            "warning",
            `Failed to shutdown session ${session.sessionId}: ${(
              shutdownError as Error
            ).message}`
          );
        }
      }
    })();
  }

  ensureNoConcurrentQuery(session: ClaudeSessionState): void {
    const active = this.#getActiveTracker(session);
    if (active && !active.completed) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Session ${session.sessionId} is processing, concurrent queries not supported.`
      );
    }
  }

  waitForModelUpdate(
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

  #getActiveTracker(session: ClaudeSessionState): PendingQuery | undefined {
    return session.pendingQueries[0];
  }

  #extractTextFromContent(content: unknown[]): string[] {
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

  #extractThinkingFromContent(content: unknown[]): string[] {
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

  #registerToolUse(
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
    void this.#sendLog(
      session,
      "debug",
      `Session ${session.sessionId} tool invocation: ${record.name ?? "<unknown>"}`
    );
  }

  #registerToolResult(
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

  async #handleStreamMessage(
    session: ClaudeSessionState,
    message: ClaudeStreamMessage
  ): Promise<void> {
    const type = typeof message.type === "string" ? message.type : "";
    const tracker = this.#getActiveTracker(session);

    if (type === "system") {
      await this.#sendLog(
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
      if (typeof permissionMode === "string") {
        const parsed = permissionModeSchema.safeParse(permissionMode);
        if (parsed.success) {
          session.options.permissionMode = parsed.data;
        }
      }
      return;
    }

    if (type === "assistant" && message.message && typeof message.message === "object") {
      const assistantMessage = message.message as Record<string, unknown>;
      const content = Array.isArray(assistantMessage.content)
        ? (assistantMessage.content as unknown[])
        : [];
      const textChunks = this.#extractTextFromContent(content);
      if (tracker && textChunks.length > 0) {
        tracker.finalTextChunks.push(...textChunks);
      }
      if (tracker && tracker.includeThinking) {
        tracker.thinkingChunks.push(...this.#extractThinkingFromContent(content));
      }
      for (const block of content) {
        if (
          block &&
          typeof block === "object" &&
          "type" in block &&
          (block as { type: string }).type === "tool_use"
        ) {
          this.#registerToolUse(
            tracker,
            block as Record<string, unknown>,
            session
          );
        }
      }
      if (textChunks.length > 0) {
        await this.#sendLog(session, "info", textChunks.join(""));
      } else {
        await this.#sendLog(
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
          this.#registerToolResult(tracker, block as Record<string, unknown>);
        }
      }
      await this.#sendLog(
        session,
        "debug",
        `Session ${session.sessionId} tool result: ${JSON.stringify(userMessage)}`
      );
      return;
    }

    if (type === "result") {
      if (!tracker) {
        await this.#sendLog(
          session,
          "warning",
          `Received result message without pending query: ${JSON.stringify(
            message
          )}`
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
      } satisfies Record<string, unknown>;

      if (subtype === "error" || message.is_error === true) {
        const errorField = (message as { error?: unknown }).error;
        const errorMessage =
          typeof errorField === "string" ? errorField : "Claude query failed.";
        tracker.reject(new Error(errorMessage));
        const index = session.pendingQueries.indexOf(tracker);
        if (index !== -1) {
          session.pendingQueries.splice(index, 1);
        }
        await this.#sendLog(session, "error", errorMessage);
        return;
      }

      await this.#finalizeResult(session, tracker);
      await this.#sendLog(
        session,
        "info",
        `Session ${session.sessionId} query completed.`
      );
      return;
    }

    if (type === "error") {
      await this.#sendLog(
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

    await this.#sendLog(
      session,
      "debug",
      `Session ${session.sessionId} received unclassified message: ${JSON.stringify(
        message
      )}`
    );
  }

  async #finalizeResult(
    session: ClaudeSessionState,
    tracker: PendingQuery
  ): Promise<void> {
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
              : "Claude query completed. See structuredContent for details.",
        },
      ],
    };
    response.structuredContent = structuredContent;

    const index = session.pendingQueries.indexOf(tracker);
    if (index !== -1) {
      session.pendingQueries.splice(index, 1);
    }

    await Promise.resolve(tracker.resolve(response));

    if (tracker.closeAfter && !session.closed) {
      await this.#shutdownSession(session.sessionId);
    }
  }
}

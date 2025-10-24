import { describe, expect, it } from "@jest/globals";

import { SessionStore } from "../src/core/session-store.js";
import type { ClaudeSessionState } from "../src/core/types.js";

function buildSession(sessionId: string): ClaudeSessionState {
  return {
    sessionId,
    client: {
      receiveMessages: async function* (): AsyncGenerator<unknown> {
        // no-op for store tests
      },
      disconnect: async () => undefined,
      query: async () => undefined,
      interrupt: async () => undefined,
      setModel: async () => undefined,
      setPermissionMode: async () => undefined,
    } as unknown as ClaudeSessionState["client"],
    options: {
      cwd: null,
      model: null,
      permissionMode: null,
      systemPrompt: null,
    },
    createdAt: new Date(),
    pendingQueries: [],
    closed: false,
    modelWaiters: [],
  } satisfies ClaudeSessionState;
}

describe("SessionStore", () => {
  it("添加与获取会话", () => {
    const store = new SessionStore();
    const session = buildSession("alpha");

    store.add(session);

    expect(store.get("alpha")).toBe(session);
    expect(store.size).toBe(1);
  });

  it("ensure 返回活动会话并在缺失时抛出", () => {
    const store = new SessionStore();
    const session = buildSession("beta");
    store.add(session);

    expect(store.ensure("beta")).toBe(session);

    expect(() => store.ensure("missing"))
      .toThrow("Session missing does not exist or is closed.");

    session.closed = true;
    expect(() => store.ensure("beta"))
      .toThrow("Session beta is closed.");
  });

  it("移除会话后 size 更新", () => {
    const store = new SessionStore();
    store.add(buildSession("gamma"));
    store.add(buildSession("delta"));

    expect(store.size).toBe(2);

    store.remove("gamma");
    expect(store.size).toBe(1);
    expect(store.get("gamma")).toBeUndefined();
  });
});

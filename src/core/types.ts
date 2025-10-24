import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ClaudeAgentSDKClient, PermissionMode } from "claude-agent-sdk-ts";

export type LoggingLevel =
  | "debug"
  | "info"
  | "notice"
  | "warning"
  | "error"
  | "critical"
  | "alert"
  | "emergency";

export type ClaudeStreamMessage = Record<string, unknown> & {
  type?: string;
  session_id?: string;
};

export interface ToolInvocationRecord {
  id: string;
  name?: string;
  input?: unknown;
  output?: unknown;
  success?: boolean;
  error?: string | null;
}

export interface PendingQuery {
  includeThinking: boolean;
  closeAfter: boolean;
  resolve: (result: CallToolResult) => void | Promise<void>;
  reject: (error: Error) => void;
  finalTextChunks: string[];
  thinkingChunks: string[];
  toolInvocations: ToolInvocationRecord[];
  toolInvocationMap: Map<string, ToolInvocationRecord>;
  metadata?: Record<string, unknown>;
  completed: boolean;
}

export interface ClaudeSessionState {
  sessionId: string;
  client: ClaudeAgentSDKClient;
  options: {
    cwd?: string | null;
    model?: string | null;
    permissionMode?: PermissionMode | null;
    systemPrompt?: string | null;
    resume?: string | null;
  };
  createdAt: Date;
  pendingQueries: PendingQuery[];
  messageLoop?: Promise<void>;
  closed: boolean;
  modelWaiters: Array<(value: string | null) => void>;
}

export type SendLog = (
  session: ClaudeSessionState | undefined,
  level: LoggingLevel,
  message: string
) => Promise<void>;

export type SessionSummary = {
  sessionId: string;
  model: string | null | undefined;
  permissionMode: PermissionMode | null | undefined;
  cwd: string | null | undefined;
  resumedFrom: string | null | undefined;
  createdAt: string;
  activeQueries: number;
  closed: boolean;
};

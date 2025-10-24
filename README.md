# Claude Agent MCP Server

**Model Context Protocol (MCP) server that bridges `claude-agent-sdk-ts` to expose streaming session capabilities for Claude Code CLI and other AI tools.**

[English](./README.md) • [中文](./README.zh-CN.md) • [日本語](./README.ja.md) • [한국어](./README.ko.md)

---

## Overview

Claude Agent MCP is a Node.js-based Model Context Protocol (MCP) server that bridges the `claude-agent-sdk-ts` library, exposing streaming conversation capabilities to Claude Code CLI and other AI development tools.

### Features

- **Standards-Compliant MCP Server**: Built on `@modelcontextprotocol/sdk` with full logging support and graceful shutdown handling.
- **Modular Runtime**: `src/core/` houses dedicated modules for session storage, message pumping, schemas, and logging helpers.
- **Session Tooling**:
  - `claude_session_create` / `claude_session_close`
  - `claude_session_list` / `claude_session_status`
  - `claude_direct_query` for one-off prompts without manual lifecycle management
- **Chat Controls**:
  - `claude_chat_query`, `claude_chat_interrupt`
  - `claude_chat_model`, `claude_chat_mode`
  - `claude_server_config` to update runtime parameters (e.g., model update timeout)
- **Streaming Feedback**: Message pump consumes `receiveMessages()` and emits structured `info`, `debug`, and `error` logs per MCP spec.
- **Streaming Feedback**: Message pump consumes `receiveMessages()` and emits structured `info`, `debug`, and `error` logs per MCP spec. The server advertises the MCP `logging` capability, so clients can subscribe to `notifications/message` and optionally call `logging/setLevel` (for example `client.setLoggingLevel('debug')`) to control verbosity.

### Quick Start

#### Installation

```bash
npm install --save claude-agent-mcp
```

#### Running the Server

```bash
# Build TypeScript (pre-built in npm package, optional)
npm run build

# Start the server
npx claude-agent-mcp

# Or run directly with Node
node dist/cli.js
```

**Requirement**: Set `ANTHROPIC_API_KEY` environment variable and have Claude CLI installed.

## Integration Examples

### Claude Code CLI

```bash
# 1. Install the package
npm install --save claude-agent-mcp

# 2. Register the MCP server
claude mcp add claude-agent-mcp \
  --command npx \
  --args claude-agent-mcp

# 3. Verify
claude mcp list
```

### Cursor IDE

Add to `~/.cursor/mcp.config.json`:

```json
{
  "servers": [
    {
      "name": "claude-agent-mcp",
      "command": "npx",
      "args": ["claude-agent-mcp"],
      "env": {
        "ANTHROPIC_API_KEY": "${ANTHROPIC_API_KEY}"
      }
    }
  ]
}
```

### Cline (VS Code Extension)

Through VS Code command palette: "Cline: Open Settings (JSON)"

```json
{
  "mcp.servers": [
    {
      "name": "claude-agent-mcp",
      "command": "npx",
      "args": ["claude-agent-mcp"],
      "cwd": "${workspaceFolder}"
    }
  ]
}
```

### Codex CLI

Configure in `$CODEX_HOME/config.toml`:

```toml
[mcp_servers.claude-agent-mcp]
command = "npx"
args = ["claude-agent-mcp"]
```

## Testing

Targeted unit tests validate the modular runtime without requiring a live Claude CLI:

- `tests/message-pump.test.ts` exercises streaming aggregation, model waiters, and error cleanup.
- `tests/session-store.test.ts` covers session lifecycle helpers and guard rails.

Helper scripts (for example `scripts/real-integration-test.ts`) assume a fully configured Claude CLI and remain opt-in.

### Running Tests

```bash
npm test
```

## Project Structure

```
├── src/
│   ├── core/
│   │   ├── logger.ts          # Safe logging wrapper
│   │   ├── message-pump.ts    # Streaming message consumer
│   │   ├── schemas.ts         # Shared Zod schemas
│   │   ├── session-store.ts   # In-memory session registry
│   │   └── types.ts           # Shared type definitions
│   ├── server.ts              # Tool registration & runtime wiring
│   └── cli.ts                 # CLI entry point
├── scripts/
│   └── real-integration-test.ts
├── tests/
│   ├── message-pump.test.ts   # Streaming behaviour & cleanup
│   ├── session-store.test.ts  # SessionStore guard rails
│   └── TEST_GUIDE.md          # Test plan and coverage notes
├── jest.config.js
├── package.json
├── tsconfig.json
├── CLAUDE.md
├── AGENTS.md
└── README.md
```

## Development

```bash
# Install dependencies
npm install

# Development mode (ts-node)
npm run dev

# Build TypeScript
npm run build

# Run all tests
npm test

# Watch mode for tests
npm run test:watch

# Generate coverage report
npm run test:coverage

# Clean build artifacts
npm run clean
```

## Publishing

```bash
# Update version
npm version patch  # or minor/major

# Build for publication
npm run build

# Publish to npm
npm publish

# Users can then use:
npx claude-agent-mcp              # Auto-download and run
npm install -g claude-agent-mcp   # Global installation
```

## Tools Reference

### `claude_session_create`

Creates a new Claude session or ensures an existing session stays active.

**Parameters:**
- `sessionId` (optional): Existing session to reuse; omit to create a new one automatically
- `cwd` (optional): Working directory
- `model` (optional): Model name (`opus` | `sonnet` | `haiku`)
- `permissionMode` (optional): Permission mode (default|acceptEdits|plan|bypassPermissions)
- `systemPrompt` (optional): Custom system prompt

**Returns:**
```json
{
  "sessionId": "uuid",
  "model": "model-name",
  "cwd": "working-directory",
  "permissionMode": "default",
  "systemPrompt": "prompt",
  "active": true,
  "createdAt": "timestamp",
  "reused": false
}
```
If `sessionId` is supplied, the call verifies the session is still open and returns the same schema with `reused: true`.

### `claude_chat_query`

Send a prompt to Claude and receive a response.

**Parameters:**
- `sessionId` (required): Session ID
- `prompt` (required): User prompt
- `closeAfter` (optional): Auto-close session after query
- `includeThinking` (optional): Include Claude's thinking process

**Returns:**
```json
{
  "finalText": "Claude's response",
  "thinking": ["thinking chunks..."],
  "toolInvocations": [
    {
      "id": "tool-id",
      "name": "tool-name",
      "input": {},
      "output": {},
      "success": true
    }
  ],
  "metadata": {
    "usage": { "input_tokens": 100, "output_tokens": 50 },
    "durationMs": 1500,
    "totalCostUsd": 0.001
  }
}
```

### `claude_chat_model`

Switch the model for a session.

**Parameters:**
- `sessionId` (required): Session ID
- `model` (required): Target model (`opus` | `sonnet` | `haiku`)

**Returns:**
```json
{
  "requestedModel": "requested-model",
  "resolvedModel": "actual-model-used"
}
```

### `claude_chat_mode`

Change the permission mode.

**Parameters:**
- `sessionId` (required): Session ID
- `permissionMode` (required): One of: default|acceptEdits|plan|bypassPermissions

**Returns:**
```json
{
  "permissionMode": "new-mode"
}
```

### `claude_chat_interrupt`

Interrupt the current query.

**Parameters:**
- `sessionId` (required): Session ID

**Returns:**
```json
{
  "interrupted": true
}
```

### `claude_session_close`

Close and clean up a session.

**Parameters:**
- `sessionId` (required): Session ID

**Returns:**
```json
{
  "sessionId": "session-id",
  "activeSessions": 0
}
```

## Architecture

Claude Agent MCP uses a clean, modular architecture:

1. **MCP Server Layer** (`server.ts`): Implements MCP protocol using `@modelcontextprotocol/sdk`
2. **Session Management**: Maintains session state and manages lifecycle
3. **Message Streaming**: Handles bidirectional communication with Claude CLI
4. **Error Handling**: Comprehensive error handling and logging

For detailed architecture information, see [CLAUDE.md](./CLAUDE.md).

## Documentation

- **[CLAUDE.md](./CLAUDE.md)** - Architecture and design decisions
- **[tests/TEST_GUIDE.md](./tests/TEST_GUIDE.md)** - Complete testing guide with 83+ examples
- **[AGENTS.md](./AGENTS.md)** - AI collaboration conventions and guidelines

## Available Languages

This README is available in multiple languages:

| Language | File |
|----------|------|
| English | [README.md](./README.md) |
| 中文 (Chinese Simplified) | [README.zh-CN.md](./README.zh-CN.md) |
| 日本語 (Japanese) | [README.ja.md](./README.ja.md) |
| 한국어 (Korean) | [README.ko.md](./README.ko.md) |

## License

MIT

## Contributing

We welcome contributions! Please ensure:
- All tests pass: `npm test`
- Code builds without errors: `npm run build`
- Documentation is updated

## Support

If you encounter any issues, please:
1. Check the [TEST_GUIDE.md](./tests/TEST_GUIDE.md) for troubleshooting
2. Review the [CLAUDE.md](./CLAUDE.md) for architecture details
3. Open an issue with detailed information about your problem

---

**Last Updated**: October 24, 2025

**Version**: 1.2.0

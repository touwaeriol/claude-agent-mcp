🚀 **Claude Agent MCP v1.1.2** - One-Step Query Release

## Overview

Minor release adding the `claude_direct_query` tool for simplified one-time queries without manual session management.

## What's New

### ⭐ One-Step Query Tool

**`claude_direct_query`** - Execute queries in a single API call!

```
claude_direct_query(prompt: string, model?: string, ...options)
```

Features:
- ✅ Automatically creates temporary session
- ✅ Executes query and streams response
- ✅ Auto-cleans resources after completion
- ✅ No session management overhead
- ✅ Perfect for quick queries and one-time tasks

### Usage Example

```json
{
  "tool_name": "claude_direct_query",
  "arguments": {
    "prompt": "What is MCP?",
    "model": "sonnet"
  }
}
```

That's it! The tool handles the rest.

## Code Quality

### English-First Codebase ✅
- All internal logs in English (27+ changes from v1.1.1)
- Consistent error messages
- Professional development experience

## Tool Summary (Now 7 Tools)

| Category | Tool | Type |
|----------|------|------|
| **Quick Query** | `claude_direct_query` ⭐ | One-step |
| **Session Mgmt** | `claude_session_create` | Manual |
| | `claude_session_close` | Manual |
| **Chat** | `claude_chat_query` | Interactive |
| | `claude_chat_interrupt` | Interactive |
| | `claude_chat_model` | Interactive |
| | `claude_chat_mode` | Interactive |

## When to Use Each

### Use `claude_direct_query` for:
- ✅ Simple Q&A
- ✅ One-time queries
- ✅ Quick prototyping
- ✅ No multi-turn context needed

### Use Session-based (`claude_session_create` + `claude_chat_query`) for:
- ✅ Multi-turn conversations
- ✅ Context preservation
- ✅ Complex interactions
- ✅ Extended discussions

## Parameter Reference

### Required
- `prompt`: Your question or command

### Optional
- `model`: `opus` | `sonnet` | `haiku`
- `permissionMode`: `default` | `acceptEdits` | `plan` | `bypassPermissions`
- `includeThinking`: `true` | `false`
- `systemPrompt`: Custom system instructions
- `cwd`: Working directory

## Breaking Changes

None. This is a purely additive release.

## Compatibility

✅ Fully backward compatible with v1.1.0 and v1.1.1.

## Resources

- **NPM**: https://www.npmjs.com/package/claude-agent-mcp@1.1.2
- **GitHub**: https://github.com/touwaeriol/claude-agent-mcp
- **Documentation**: CLAUDE.md, CODEX_SETUP.md

---

**Release Date**: 2025-10-23
**Status**: Production Ready ✅

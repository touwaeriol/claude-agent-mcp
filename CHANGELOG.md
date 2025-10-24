# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.3.0] - 2025-10-24

### Changed
- `claude_session_create` 将 `sessionId` 参数映射为 SDK 的 `resume` 选项，用于触发 Claude CLI `--resume`，并通过返回值的 `resumed`/`resumedFrom` 标记恢复状态。

## [1.2.0] - 2025-10-24

### Added
- Schema-level tests covering model与权限参数的枚举校验，确保非法取值立即被拒绝。

### Changed
- `claude_session_create` 支持传入 `sessionId` 复用活跃会话，同时禁止在复用时修改现有选项。
- 所有模型参数统一限制为 `opus`、`sonnet` 或 `haiku`，非法模型值会返回 `InvalidParams` 错误。
- 文档更新（README、CLAUDE.md）以反映新的参数约束与会话复用行为。

### Fixed
- 防止使用过期或关闭的会话 ID 创建新会话，避免隐式生成冲突状态。

## [1.1.2] - 2025-10-23

### Added
- **One-Step Query Tool**: `claude_direct_query` for direct queries without session management
  - Automatically creates temporary session
  - Executes query and returns response
  - Auto-cleans resources after completion
  - Perfect for one-time queries and quick prototyping
- **Enhanced Documentation**: Updated CODEX_SETUP.md with new tool usage guide

### Changed
- Tool count increased from 6 to 7

## [1.1.1] - 2025-10-23

### Added
- **Code Internationalization**: All Chinese logs and error messages replaced with English (27+ changes)

## [1.1.0] - 2025-10-23

### Added
- **Comprehensive Test Suite**: 112 unit tests covering all core functionality
  - 38 server unit tests (`tests/server.test.ts`)
  - 45 MCP tool layer tests (`tests/mcp-tools.test.ts`)
  - 29 integration tests (`tests/integration.test.ts`)
- **Real Integration Testing**: Complete functional testing of all 6 MCP tools via StdioClientTransport
  - Verified session creation, model switching, permission mode changes, query interruption, and session closure
  - All tests execute in ~15.7 seconds with 100% success rate
- **Multi-Language Documentation**: Complete README in 4 languages following GitHub best practices
  - English (default): `README.md`
  - Simplified Chinese: `README.zh-CN.md`
  - Japanese: `README.ja.md`
  - Korean: `README.ko.md`
  - Language navigation links in all versions
- **Jest Testing Framework Integration**: Fully configured Jest with TypeScript support
  - `jest.config.js` configuration
  - Test scripts: `npm test`, `npm run test:watch`, `npm run test:coverage`
- **Complete Testing Guide**: `tests/TEST_GUIDE.md` with 80+ test examples and documentation
- **Real Integration Test Script**: `scripts/real-integration-test.ts` for functional validation
- **MIT License**: Added `LICENSE` file with standard MIT terms

### Changed
- **NPM Package Structure**: Optimized for production use
  - Updated `package.json` with proper bin, main, and types fields
  - CLI entry point configured at `dist/cli.js` with proper shebang
  - All dependencies correctly specified and versioned
- **Project Documentation**: Improved README structure with comprehensive sections
  - Quick Start guide
  - Integration examples for Claude Code CLI, Cursor, Cline, and Codex
  - Complete Tools Reference with JSON response examples
  - Architecture overview
  - Development and publishing instructions

### Fixed
- TypeScript dynamic import compatibility issues
- Integration test type incompatibilities
- Build artifact verification
- Dependencies validation and installation

### Verified
- ✅ All 6 MCP tools correctly implemented and functional
- ✅ MCP protocol compliance (no illegal characters, proper data formats)
- ✅ NPX availability and CLI execution
- ✅ Package metadata (bin, main, types fields)
- ✅ Build process error-free
- ✅ Complete test coverage with 100% pass rate
- ✅ Multi-language documentation completeness

## [1.0.1] - 2025-10-23

### Added
- Initial implementation of comprehensive testing infrastructure
- Multi-language README framework
- Project structure optimization

### Changed
- Updated version from 1.0.0 to 1.0.1
- Restructured documentation for internationalization

## [1.0.0] - 2025-10-21

### Added
- **MCP Server Implementation**: Complete Node.js-based Model Context Protocol server
  - Built on `@modelcontextprotocol/sdk` with `StdioServerTransport`
  - Session management via `ClaudeAgentSDKClient`
  - Message streaming with bidirectional communication

- **Six Core MCP Tools**:
  - `claude_session_create`: Create new Claude sessions with configurable options
  - `claude_session_close`: Close and clean up sessions
  - `claude_chat_query`: Send prompts and receive streaming responses
  - `claude_chat_interrupt`: Interrupt active queries
  - `claude_chat_model`: Switch between AI models
  - `claude_chat_mode`: Change permission modes

- **Session Management**:
  - Session lifecycle management (create, modify, close)
  - Session state caching with `Map<string, ClaudeSessionState>`
  - Automatic resource cleanup on session close
  - Support for concurrent session operations

- **Streaming Features**:
  - Real-time message streaming from Claude AI
  - Structured logging with info, debug, and error levels
  - Tool invocation tracking with input/output/success status
  - Thinking process inclusion support
  - Token usage and cost calculation

- **Error Handling**:
  - Comprehensive error handling with proper MCP error responses
  - Detailed error logging with session context
  - Graceful handling of concurrent query conflicts

- **CLI Interface**:
  - Command-line entry point at `src/cli.ts`
  - Support for `npx` and global npm installation
  - Integration with Claude Code CLI and other IDE tools

- **Architecture & Documentation**:
  - Clean modular architecture with separation of concerns
  - Detailed architecture documentation (`CLAUDE.md`)
  - AI collaboration conventions (`AGENTS.md`)
  - Comprehensive README with integration examples

- **Development Tools**:
  - TypeScript configuration with strict type checking
  - Build process with npm scripts
  - Development mode support via `ts-node`

### Technical Details
- **Runtime**: Node.js with CommonJS modules
- **Language**: TypeScript with full type definitions
- **Dependencies**:
  - `@modelcontextprotocol/sdk`: ^1.20.1
  - `claude-agent-sdk-ts`: ^1.0.0
- **Environment Requirements**:
  - `ANTHROPIC_API_KEY` environment variable
  - Claude CLI installed and configured

---

## Version History Summary

| Version | Release Date | Focus | Status |
|---------|-------------|-------|--------|
| v1.0.0  | 2025-10-21  | Initial MCP server implementation | Archived |
| v1.0.1  | 2025-10-23  | Test suite and documentation | Archived |
| v1.1.0  | 2025-10-23  | Production release with full testing | Latest ✅ |

## Release Schedule

- **v1.0.0**: Bootstrap with core MCP functionality
- **v1.0.1**: Comprehensive testing framework and multi-language docs
- **v1.1.0**: Production-ready with verified test coverage and npm publication
- **v1.1.0+**: Ongoing maintenance and feature additions

## How to Use

### Viewing Specific Versions

```bash
# Check out a specific version tag
git checkout v1.0.0
git checkout v1.0.1
git checkout v1.1.0

# View release information
git show v1.1.0
git tag -v v1.1.0
```

### Installation by Version

```bash
# Latest version (recommended)
npm install claude-agent-mcp@latest
npm install claude-agent-mcp@1.1.0

# Specific older versions
npm install claude-agent-mcp@1.0.1
npm install claude-agent-mcp@1.0.0
```

### Global Installation

```bash
# Latest
npm install -g claude-agent-mcp

# Specific version
npm install -g claude-agent-mcp@1.1.0
```

---

**Last Updated**: 2025-10-23

**Next Version**: 1.2.0 (planned for future development)

For more information, see:
- [README.md](./README.md) - Project overview
- [CLAUDE.md](./CLAUDE.md) - Architecture documentation
- [LICENSE](./LICENSE) - MIT License

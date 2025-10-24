# Claude Agent MCP 服务器

[English](./README.md) • [中文](./README.zh-CN.md) • [日本語](./README.ja.md) • [한국어](./README.ko.md)

## 概述

Claude Agent MCP 是一个基于 Node.js 的 Model Context Protocol (MCP) 服务器，用于桥接 `claude-agent-sdk-ts` 库，向 Claude Code CLI 和其他 AI 开发工具暴露流式对话能力。

### 主要功能

- **标准化 MCP 服务器**：基于 `@modelcontextprotocol/sdk`，支持日志输出与优雅的关闭流程。
- **模块化运行时**：`src/core/` 下拆分日志、会话存储、消息泵与 Zod 模式，便于维护与测试。
- **会话工具矩阵**：
  - `claude_session_create` / `claude_session_close`
  - `claude_session_list` / `claude_session_status`
  - `claude_direct_query` 适用于一次性问答场景
- **对话控制**：
  - `claude_chat_query`、`claude_chat_interrupt`
  - `claude_chat_model`、`claude_chat_mode`
  - `claude_server_config` 可调整运行期参数（例如模型更新超时）
- **流式消息泵**：消费 Claude CLI 的 `receiveMessages()`，按 MCP 协议发送 `info` / `debug` / `error` 日志。服务器声明 MCP 的 `logging` 能力，客户端可订阅 `notifications/message` 并通过 `logging/setLevel`（例如 `client.setLoggingLevel('debug')`）调节日志级别。

## 快速开始

### 安装

```bash
npm install --save claude-agent-mcp
```

### 运行服务

```bash
# 构建 TypeScript（npm 包已预置编译产物，可选）
npm run build

# 启动服务
npx claude-agent-mcp

# 或者直接用 Node 运行
node dist/cli.js
```

**必需条件**：设置 `ANTHROPIC_API_KEY` 环境变量，并安装 Claude CLI。

## 集成示例

### Claude Code CLI

```bash
# 1. 安装依赖
npm install --save claude-agent-mcp

# 2. 注册 MCP 服务
claude mcp add claude-agent-mcp \
  --command npx \
  --args claude-agent-mcp

# 3. 验证
claude mcp list
```

### Cursor IDE

在 `~/.cursor/mcp.config.json` 中添加：

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

### Cline (VS Code 扩展)

通过 VS Code 命令面板：选择 "Cline: Open Settings (JSON)"

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

在 `$CODEX_HOME/config.toml` 中配置：

```toml
[mcp_servers.claude-agent-mcp]
command = "npx"
args = ["claude-agent-mcp"]
```

## 测试

仓库提供针对核心模块的 Jest 单元测试：

- `tests/message-pump.test.ts`：验证流式消息聚合、模型等待与异常时的资源清理。
- `tests/session-store.test.ts`：覆盖会话增删改查与安全校验逻辑。

额外的 `scripts/real-integration-test.ts` 依赖完整的 Claude CLI 环境，可按需手动运行。

```bash
npm test
```

## 项目结构

```
├── src/
│   ├── core/
│   │   ├── logger.ts          # 日志封装
│   │   ├── message-pump.ts    # 流式消息泵
│   │   ├── schemas.ts         # Zod 参数定义
│   │   ├── session-store.ts   # 会话存储
│   │   └── types.ts           # 共享类型声明
│   ├── server.ts              # 工具注册与运行时装配
│   └── cli.ts                 # CLI 入口
├── scripts/
│   └── real-integration-test.ts
├── tests/
│   ├── message-pump.test.ts   # 流式逻辑单测
│   ├── session-store.test.ts  # 会话存储单测
│   └── TEST_GUIDE.md          # 测试说明
├── jest.config.js
├── package.json
├── tsconfig.json
├── CLAUDE.md
└── README.zh-CN.md
```

## 开发

```bash
# 安装依赖
npm install

# 开发模式（ts-node）
npm run dev

# 构建 TypeScript
npm run build

# 运行所有测试
npm test

# 监视模式测试
npm run test:watch

# 生成覆盖率报告
npm run test:coverage

# 清理构建产物
npm run clean
```

## 发布

```bash
# 更新版本
npm version patch  # 或 minor/major

# 构建发布版本
npm run build

# 发布到 npm
npm publish

# 用户随后可以使用：
npx claude-agent-mcp              # 自动下载并运行
npm install -g claude-agent-mcp   # 全局安装
```

## 工具参考

### `claude_session_create`
创建一个新的 Claude 会话，或通过 Claude CLI 的 `--resume` 恢复历史会话。

**参数：**
- `sessionId`（可选）：Claude CLI 中的历史会话 ID，用于 `--resume`；不传则启动全新会话
- `cwd`（可选）：工作目录
- `model`（可选）：模型名称（仅限 `opus`、`sonnet`、`haiku`）
- `permissionMode`（可选）：权限模式（default|acceptEdits|plan|bypassPermissions）
- `systemPrompt`（可选）：自定义系统提示

**返回值：** `{ sessionId, model, cwd, permissionMode, systemPrompt, active, createdAt, resumed, resumedFrom }`

当传入 `sessionId` 时，SDK 会调用 Claude CLI 的 `--resume` 选项尝试恢复，并在返回值中标记 `resumed=true`、`resumedFrom=<会话ID>`。

### `claude_chat_query`
发送提示词给 Claude 并接收响应。

**参数：**
- `sessionId`（必需）：会话 ID
- `prompt`（必需）：用户提示词
- `closeAfter`（可选）：查询后自动关闭会话
- `includeThinking`（可选）：包含 Claude 的思考过程

**返回值：** `{ finalText, thinking[], toolInvocations[], metadata }`

### `claude_chat_model`
切换会话使用的模型。

**参数：**
- `sessionId`（必需）：会话 ID
- `model`（必需）：目标模型（仅限 `opus`、`sonnet`、`haiku`）

**返回值：** `{ requestedModel, resolvedModel }`

### `claude_chat_mode`
更改权限模式。

**参数：**
- `sessionId`（必需）：会话 ID
- `permissionMode`（必需）：权限模式之一：default|acceptEdits|plan|bypassPermissions

**返回值：** `{ permissionMode }`

### `claude_chat_interrupt`
中断当前查询。

**参数：**
- `sessionId`（必需）：会话 ID

**返回值：** `{ interrupted: true }`

### `claude_session_close`
关闭并清理会话。

**参数：**
- `sessionId`（必需）：会话 ID

**返回值：** `{ activeSessions: number }`

## 文档

- **[CLAUDE.md](./CLAUDE.md)** - 架构和设计决策
- **[tests/TEST_GUIDE.md](./tests/TEST_GUIDE.md)** - 完整的测试指南
- **[AGENTS.md](./AGENTS.md)** - AI 协作约定

## 许可证

MIT

## 贡献

欢迎贡献！请确保：
- 所有测试通过：`npm test`
- 代码无构建错误：`npm run build`
- 文档已更新

---

**最后更新**：2025 年 10 月 24 日

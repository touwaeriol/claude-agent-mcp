# Claude Agent MCP 服务器

[English](./README.md) • [中文](./README.zh-CN.md) • [日本語](./README.ja.md) • [한국어](./README.ko.md)

## 概述

Claude Agent MCP 是一个基于 Node.js 的 Model Context Protocol (MCP) 服务器，用于桥接 `claude-agent-sdk-ts` 库，向 Claude Code CLI 和其他 AI 开发工具暴露流式对话能力。

### 主要功能

- **MCP 服务器实现**：基于 `@modelcontextprotocol/sdk` 实现，完全符合 MCP 协议标准
- **会话管理**：复用 `ClaudeAgentSDKClient` 进行强大的会话管理
- **六大核心工具**：
  - `claude_session_create` - 创建新的 Claude 会话
  - `claude_session_close` - 关闭并清理会话
  - `claude_chat_query` - 发送提示词并接收流式响应
  - `claude_chat_interrupt` - 中断活跃查询
  - `claude_chat_model` - 在不同模型之间切换
  - `claude_chat_mode` - 更改权限模式
- **流式日志**：为不同消息类型提供 `info`、`debug` 和 `error` 级别的结构化日志

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

运行完整的集成测试套件：

```bash
npm install
npm run build
npx ts-node scripts/real-integration-test.ts
```

测试覆盖：
- ✅ 112 个单元测试覆盖所有核心功能
- ✅ 29 个集成测试确保部署就绪
- ✅ 完整的 MCP 协议合规性验证

## 项目结构

```
├── src/
│   ├── server.ts              # MCP 服务器核心实现（790 行）
│   └── cli.ts                 # CLI 启动入口
├── scripts/
│   ├── mcp-smoke.ts           # 烟雾测试脚本
│   └── real-integration-test.ts # 完整集成测试
├── tests/
│   ├── server.test.ts         # 单元测试（38 个）
│   ├── mcp-tools.test.ts      # 工具层测试（45 个）
│   ├── integration.test.ts    # 集成测试（29 个）
│   └── TEST_GUIDE.md          # 完整测试文档
├── package.json
├── tsconfig.json
├── CLAUDE.md                  # 架构指南
└── README.zh-CN.md            # 本文件
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
创建一个新的 Claude 会话。

**参数：**
- `cwd`（可选）：工作目录
- `model`（可选）：模型名称
- `permissionMode`（可选）：权限模式（default|acceptEdits|plan|bypassPermissions）
- `systemPrompt`（可选）：自定义系统提示

**返回值：** `{ sessionId, model, cwd, active, createdAt }`

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
- `model`（必需）：目标模型

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

**最后更新**：2025 年 10 月 23 日

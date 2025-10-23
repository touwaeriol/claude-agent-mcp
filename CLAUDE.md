# Claude Agent MCP 项目协作指南

本项目实现一个基于 Node.js 的 MCP 服务器，用于桥接刚发布的 `claude-agent-sdk-ts`，向 Claude Code CLI 暴露流式会话能力。本文档记录所有 AI 协作者需要牢记的约定与设计。**禁止**在项目中重复撰写或解释 Claude CLI 的安装与使用，仅聚焦于 MCP 功能本身。

## 使用方式

- 构建：`npm run build`
- CLI 启动：`node dist/cli.js`
- 作为全局 / npx 命令：发布后可运行 `npx claude-agent-mcp`（或 `claude-agent-mcp`，依赖包 `bin` 指向 `dist/cli.js`）。

## 总体设计

- 使用 `@modelcontextprotocol/sdk` 搭建 `McpServer`，默认通过 `StdioServerTransport` 运行。
- 会话管理完全依赖 `ClaudeAgentSDKClient`，并按照 `sessionId` 复用客户端实例。
- MCP 工具在执行期间同步监听 `receiveMessages()`，将流式内容通过 MCP 通知回传，结束后再返回整合结果。
- 所有 Claude 请求都要求调用方在环境中预先配置 `ANTHROPIC_API_KEY`。

## 暴露的 MCP 工具

### 参数快速指南

#### 模型 (可选，不传则使用默认模型)

传入以下值之一即可，无需版本号：

```
opus        # 最强大，适合复杂任务
sonnet      # 平衡性能和速度 (推荐)
haiku       # 最轻量，速度最快
```

不传 → 使用默认模型

#### 权限模式 (可选，不传则使用 `default`)

传入以下值之一：

```
default             # 需要用户确认 (推荐)
acceptEdits         # 自动接受编辑
plan                # 仅规划，不执行
bypassPermissions   # 绕过权限检查
```

不传 → 使用 `default`

#### 其他参数

```
closeAfter: true/false           # 默认 false，是否自动关闭会话
includeThinking: true/false      # 默认 false，是否返回思考过程
```

### `claude_session_create`

- **功能**：创建新的 Claude 会话并返回 `sessionId`。
- **参数**：
  - `cwd` *(string, optional)*：工作目录
  - `model` *(string, optional)*：模型选择：`opus` | `sonnet` | `haiku`，不传则使用默认模型
  - `permissionMode` *(string, optional)*：权限模式：`default` | `acceptEdits` | `plan` | `bypassPermissions`，不传则使用 `default`
  - `systemPrompt` *(string, optional)*：自定义系统提示词
- **返回**：
  - `sessionId`: 生成的会话 ID。
  - `model`: 当前模型。
  - `cwd`: 工作目录。
  - `active`: 布尔值，标记是否已连接成功。

### `claude_session_close`

- **功能**：显式销毁指定 `sessionId` 的客户端实例，释放资源。
- **参数**：`sessionId` *(string, required)*。
- **返回**：
  - `sessionId`
  - `activeSessions`: 剩余会话数量。

### `claude_chat_query`

- **功能**：向指定会话发送用户提示词，获取流式回复。
- **主要参数**：
  - `sessionId` *(string, required)*：会话标识
  - `prompt` *(string, required)*：用户输入内容
  - `closeAfter` *(boolean, optional, default: false)*：是否自动关闭会话
  - `includeThinking` *(boolean, optional, default: false)*：是否返回模型的思考过程
- **流式反馈**：
  - 消费 `receiveMessages()`，区分消息类型后通过 `server.server.sendLoggingMessage` 推送：
    - `assistant`（文本片段）→ `info` 日志。
    - `assistant` 内包含的 `tool_use` 以及 `user` 类型中的 `tool_result` → `debug` 日志（附工具名称）。
    - `thinking` → 仅在 `includeThinking` 为真时追加日志与结果。
  - 若发生错误，发送 `error` 日志并抛出。
- **最终返回**：`CallToolResult`
  - `content[0].text` 为 Claude 聚合后的回复（若无文本则提示查看结构化内容）。
  - `structuredContent` 提供：
    - `finalText`: Claude 最终回复（字符串）。
    - `thinking`: 思考片段数组，仅在 `includeThinking=true` 时存在。
    - `toolInvocations`: 记录工具调用的输入 / 输出 / 成功状态 / 错误信息。
    - `sessionId`: 返回使用的会话。
    - `metadata`: `usage`、`durationMs`、`totalCostUsd` 等统计信息。
  - 查询期间禁止并发：若前一轮尚未完成会抛出 `InvalidParams`。
  - 当 `closeAfter=true` 时，结果返回后自动执行 `claude_session_close`。

### `claude_chat_interrupt`

- **功能**：中断指定会话。
- **参数**：`sessionId`。
- **返回**：`{ interrupted: boolean, sessionId }`。

### `claude_chat_model`

- **功能**：切换指定会话使用的模型。
- **参数**：
  - `sessionId` *(string, required)*：会话标识
  - `model` *(string, required)*：目标模型：`opus` | `sonnet` | `haiku`
- **实现**：调用 `client.setModel(model)`，并等待下一条 `system` 消息以获取真实模型 ID。
- **返回**：`{ sessionId, requestedModel, resolvedModel }`；若 CLI 未返回新模型，则 `resolvedModel` 可能为 `null`。

### `claude_chat_mode`

- **功能**：切换权限模式。
- **参数**：
  - `sessionId` *(string, required)*：会话标识
  - `permissionMode` *(string, required)*：权限模式：`default` | `acceptEdits` | `plan` | `bypassPermissions`
- **实现**：调用 `client.setPermissionMode`。
- **返回**：`{ sessionId, permissionMode }`。

### `claude_direct_query` ⭐ 一键查询工具

- **功能**：一步到位的查询工具，自动创建临时会话、执行查询、销毁会话。无需手动管理会话生命周期。
- **参数**：
  - `prompt` *(string, required)*：用户输入内容
  - `model` *(string, optional)*：模型选择：`opus` | `sonnet` | `haiku`，不传则使用默认模型
  - `permissionMode` *(string, optional)*：权限模式：`default` | `acceptEdits` | `plan` | `bypassPermissions`，不传则使用 `default`
  - `includeThinking` *(boolean, optional, default: false)*：是否返回模型的思考过程
  - `systemPrompt` *(string, optional)*：自定义系统提示词
  - `cwd` *(string, optional)*：工作目录
- **流程**：
  1. 自动创建临时会话
  2. 发送查询
  3. 等待响应
  4. 自动销毁会话
  5. 返回结果
- **返回**：与 `claude_chat_query` 相同的响应格式
- **示例用途**：一次性查询，不需要多轮对话

> 未来若添加列出会话、查询历史等功能，请继续按照 `claude_` 前缀命名，并复用同一会话缓存。

## 流式输出策略

- MCP 服务器启动后即保持常驻进程，所有流式输出依靠 `logging` 通知实现。
- Claude 的文本回复映射为 `info`；工具调用、工具结果等结构化事件以 `debug` 记录；异常则以 `error` 报告。
- 需确保在工具返回之前，所有待发送的通知都已写入；可通过在最终结果前插入一条 `"<session> completed"` 日志以提示完成。
- 在非 Claude CLI 环境下运行 `npm run dev` 时，除非主动 `console.log`，控制台不会展示上述通知；真正的流式体验由 MCP 客户端负责渲染。

## 实现注意事项

- 会话映射：使用 `Map<string, ClaudeSessionState>` 管理，结构中至少包含 `client`、`listeners`、`lastModel`、`cwd`、`createdAt` 等字段；创建客户端时即启动 `receiveMessages()` 的消费协程，确保只创建一次。
- 错误处理：`ClaudeAgentSDKClient` 抛出的异常应转换为 MCP 错误响应，同时在日志中给出上下文（sessionId、提示词摘要）。
- 资源清理：`claude_session_close` 或进程退出时调用 `client.disconnect()`，解除挂起的流。
- 查询执行采用严格队列模型，仅允许单一活动查询；若 CLI 主动退出，挂起的查询会被逐一拒绝并写入 `error` 日志。
- `system` 初始化消息会同步更新缓存中的模型与权限模式信息。
- 测试：优先编写针对工具层的单元测试，模拟 Claude SDK 输出，验证日志/结果格式是否符合约定。
- 禁止将业务外的教程（安装 CLI、npm 登录等）写入仓库文档。

## AI 协作者操作约定

- 所有变更需同步更新本文档，保持工具参数/返回值与实现一致。
- 修改代码前务必检查 CLAUDE.md，避免引入冲突实现。
- 若新增环境变量或配置项（例如自定义模型列表），需在此记录默认值与使用方式。
- 代码中默认使用 `async/await`，避免引入额外的控制流工具库。

> 记忆：当前仓库只聚焦 MCP 工具实现，任何安装与发布说明都交由 README 或外部文档处理，CLAUDE.md 仅记录架构与协作约定。

# Claude Agent MCP 项目协作指南

本项目实现一个基于 Node.js 的 MCP 服务器，用于桥接刚发布的 `claude-agent-sdk-ts`，向 Claude Code CLI 暴露流式会话能力。本文档记录所有 AI 协作者需要牢记的约定与设计。**禁止**在项目中重复撰写或解释 Claude CLI 的安装与使用，仅聚焦于 MCP 功能本身。

## 使用方式

- 构建：`npm run build`
- CLI 启动：`node dist/cli.js`
- 作为全局 / npx 命令：发布后可运行 `npx claude-agent-mcp`（或 `claude-agent-mcp`，依赖包 `bin` 指向 `dist/cli.js`）。

## 总体设计

- 使用 `@modelcontextprotocol/sdk` 搭建 `McpServer`，默认通过 `StdioServerTransport` 运行。
- 会话管理完全依赖 `ClaudeAgentSDKClient`，每个 MCP 会话拥有独立的客户端实例。
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

- **功能**：创建新的 Claude 会话，或通过传入 `sessionId` 使用 Claude CLI 的 `--resume` 恢复历史会话。
- **参数**：
  - `sessionId` *(string, optional)*：Claude CLI 历史会话 ID，恢复时需传入；不传则创建新会话。
  - `cwd` *(string, optional)*：工作目录
  - `model` *(string, optional)*：模型选择：`opus` | `sonnet` | `haiku`，不传则使用默认模型
  - `permissionMode` *(string, optional)*：权限模式：`default` | `acceptEdits` | `plan` | `bypassPermissions`，不传则使用 `default`
  - `systemPrompt` *(string, optional)*：自定义系统提示词
- **注意**：模型字段会强制限制为 `opus` / `sonnet` / `haiku`，权限模式仅允许枚举值；当传入 `sessionId` 时，会调用 CLI `--resume`，若 CLI 不存在该会话将抛出错误。
- **返回**：
  - `sessionId`: MCP 分配的会话 ID。
  - `model`: 当前模型。
  - `cwd`: 工作目录。
  - `permissionMode`: 当前权限模式。
  - `systemPrompt`: 系统提示词。
  - `active`: 布尔值，标记是否已连接成功。
  - `createdAt`: 创建时间。
  - `resumed`: 布尔值，标记是否尝试通过 CLI 恢复。
  - `resumedFrom`: 若恢复，记录传入的 CLI 会话 ID；否则为 `null`。

### `claude_session_close`

- **功能**：显式销毁指定 `sessionId` 的客户端实例，释放资源。
- **参数**：`sessionId` *(string, required)*。
- **返回**：
  - `sessionId`
  - `activeSessions`: 剩余会话数量。

### `claude_session_list`

- **功能**：列出当前存活的会话概要信息。
- **参数**：无。
- **返回**：
  - `total`: 当前会话数量。
- `sessions`: `SessionSummary[]`，包含 `sessionId`、`model`、`permissionMode`、`cwd`、`resumedFrom`、`createdAt`、`activeQueries`、`closed` 等字段。

### `claude_session_status`

- **功能**：查询指定会话的详细状态与挂起查询队列。
- **参数**：`sessionId` *(string, required)*。
- **返回**：
  - `session`: 单个 `SessionSummary`。
  - `pendingQueries`: 每个查询的 `includeThinking`、`closeAfter`、`completed`、`toolInvocationCount` 等信息。
  - `waitingModelListeners`: 当前等待模型更新的监听器数量。

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

### `claude_server_config`

- **功能**：查询或更新服务器级运行参数。
- **参数**：
  - `modelUpdateTimeoutMs` *(number, optional)*：自定义模型切换等待超时时间（毫秒）。
- **返回**：`{ modelUpdateTimeoutMs }`；若设置新值，将同步写入并通过日志提示。

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

- 会话存储：通过 `SessionStore` 统一管理，会话实体位于 `ClaudeSessionState`，包含 `pendingQueries`、`modelWaiters` 等字段。
- 消息泵：`MessagePump` 负责串行消费 `receiveMessages()`，并依赖回调式 `shutdownSession` 统一清理资源与队列。
- 资源清理：`shutdownSession` 会记录日志、拒绝未完成查询、清空 `modelWaiters` 并调用 `client.disconnect()`；`SIGINT/SIGTERM` 会遍历关闭所有会话后再退出。
- 并发约束：同一会话仅允许单一活跃查询，违反时抛出 `McpError(ErrorCode.InvalidParams, ...)`。
- `system` 消息用于更新模型与权限模式，同时唤醒 `waitForModelUpdate`。
- 测试：当前 Jest 单测覆盖 `SessionStore` 与 `MessagePump` 的关键路径；新增模块时请同步补充。
- 禁止将业务外的教程（安装 CLI、npm 登录等）写入仓库文档。

## AI 协作者操作约定

- 所有变更需同步更新本文档，保持工具参数/返回值与实现一致。
- 修改代码前务必检查 CLAUDE.md，避免引入冲突实现。
- 若新增环境变量或配置项（例如自定义模型列表），需在此记录默认值与使用方式。
- 代码中默认使用 `async/await`，避免引入额外的控制流工具库。

> 记忆：当前仓库只聚焦 MCP 工具实现，任何安装与发布说明都交由 README 或外部文档处理，CLAUDE.md 仅记录架构与协作约定。

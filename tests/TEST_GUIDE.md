# Claude Agent MCP 单元测试指南

## 概述

本项目包含 **83 个单元测试**，分布在两个测试文件中，全部通过。测试覆盖了：

- ✅ MCP 工具层的所有 6 个工具
- ✅ 参数验证和类型检查
- ✅ 流式消息处理和日志记录
- ✅ 错误处理和边界情况
- ✅ MCP 协议合规性
- ✅ 会话状态管理

## 测试文件

### 1. `tests/server.test.ts` (38 个测试)

**目的**：验证 MCP 服务器的核心功能和数据格式

#### 工具名称验证 (3 个测试)
- ✅ 应该包含所有必需的工具
- ✅ 工具名称应该使用蛇形命名法 (snake_case)
- ✅ 应该使用 `claude_` 前缀

**验证内容**：确保工具名称符合 MCP 规范，不包含非法字符（如点 `.`）。

#### 会话创建参数验证 (4 个测试)
- ✅ 应该接受可选的 `cwd` 参数（工作目录）
- ✅ 应该接受可选的 `model` 参数（模型名称）
- ✅ 应该接受可选的 `permissionMode` 参数（权限模式）
- ✅ 应该接受可选的 `systemPrompt` 参数（系统提示）

**验证内容**：`claude_session_create` 工具的入参类型和可选性。

#### 查询参数验证 (4 个测试)
- ✅ 应该要求 `sessionId` 参数
- ✅ 应该要求 `prompt` 参数
- ✅ 应该支持可选的 `closeAfter` 参数（查询后自动关闭会话）
- ✅ 应该支持可选的 `includeThinking` 参数（返回思考过程）

**验证内容**：`claude_chat_query` 工具的参数规范。

#### 工具调用参数验证 (3 个测试)
- ✅ `claude_chat_interrupt` 应该要求 `sessionId`
- ✅ `claude_chat_model` 应该要求 `sessionId` 和 `model`
- ✅ `claude_chat_mode` 应该要求 `sessionId` 和 `permissionMode`

**验证内容**：其他工具的必需参数。

#### 流式消息处理 (6 个测试)
- ✅ 应该能处理 `assistant` 类型消息（助手回复）
- ✅ 应该能处理 `tool_use` 内容块（工具调用）
- ✅ 应该能处理 `tool_result` 内容块（工具结果）
- ✅ 应该能处理 `system` 类型消息（系统消息）
- ✅ 应该能处理 `result` 类型消息（查询结果）
- ✅ 应该能处理 `error` 类型消息（错误消息）

**验证内容**：服务器能正确解析和处理来自 Claude 的各种流式消息类型。

#### 结果格式验证 (3 个测试)
- ✅ `CallToolResult` 应该包含 `content` 和 `structuredContent`
- ✅ `structuredContent` 应该包含工具调用信息
- ✅ `structuredContent` 可以包含 `thinking` 字段

**验证内容**：返回结果的数据结构符合 MCP 规范。

#### 权限模式验证 (4 个测试)
- ✅ 应该支持 `default` 权限模式
- ✅ 应该支持 `acceptEdits` 权限模式
- ✅ 应该支持 `plan` 权限模式
- ✅ 应该支持 `bypassPermissions` 权限模式

**验证内容**：所有权限模式都被正确定义和支持。

#### 日志级别验证 (4 个测试)
- ✅ 应该支持 `debug` 日志级别
- ✅ 应该支持 `info` 日志级别
- ✅ 应该支持 `warning` 日志级别
- ✅ 应该支持 `error` 日志级别

**验证内容**：日志系统支持的所有级别。

#### 会话状态管理 (4 个测试)
- ✅ 应该为每个会话生成唯一的 `sessionId`
- ✅ 会话应该记录创建时间
- ✅ 应该跟踪会话的打开/关闭状态
- ✅ 应该维护待处理查询队列

**验证内容**：会话生命周期管理。

#### 错误处理 (3 个测试)
- ✅ 应该在会话不存在时报错
- ✅ 应该在会话已关闭时报错
- ✅ 应该在并发查询时报错

**验证内容**：错误边界和约束检查。

---

### 2. `tests/mcp-tools.test.ts` (45 个测试)

**目的**：深入测试每个 MCP 工具的功能和行为

#### claude_session_create 会话创建工具 (7 个测试)
- ✅ 应该返回有效的 `sessionId`（UUID 格式）
- ✅ 应该返回包含 `content` 和 `structuredContent` 的响应
- ✅ 应该在 `structuredContent` 中包含 `sessionId`
- ✅ 应该在创建时记录 `createdAt` 时间戳
- ✅ 应该支持传入自定义 `cwd`
- ✅ 应该支持传入自定义 `model`
- ✅ 应该支持传入 `systemPrompt`

**验证内容**：
```javascript
// 创建会话请求
{
  cwd: '/home/user/project',
  model: 'claude-3-5-sonnet-20241022',
  systemPrompt: '你是一个编程助手'
}

// 创建会话响应
{
  content: [{
    type: 'text',
    text: 'Claude 会话已创建：...'
  }],
  structuredContent: {
    sessionId: '<uuid>',
    model: null,
    cwd: null,
    active: true,
    createdAt: '2024-10-23T...'
  }
}
```

#### claude_session_close 会话关闭工具 (3 个测试)
- ✅ 应该接受 `sessionId` 参数
- ✅ 应该返回会话关闭的确认消息
- ✅ 应该返回剩余的活跃会话数量

**验证内容**：会话的正确关闭和资源清理。

#### claude_chat_query 查询工具 (8 个测试)
- ✅ 应该要求 `sessionId` 和 `prompt`
- ✅ 应该支持 `closeAfter` 参数
- ✅ 应该支持 `includeThinking` 参数
- ✅ 返回结果应该包含 `finalText`
- ✅ 返回结果应该包含 `toolInvocations` 数组
- ✅ 返回结果应该包含 `metadata`（使用量、耗时、成本）
- ✅ 当 `includeThinking=true` 时应该包含 `thinking`
- ✅ 并发查询应该报错（严格队列模型）

**验证内容**：
```javascript
// 查询请求
{
  sessionId: '<uuid>',
  prompt: '请简要说明 MCP 是什么？',
  closeAfter: false,
  includeThinking: true
}

// 查询响应
{
  content: [{
    type: 'text',
    text: '...' // Claude 回复
  }],
  structuredContent: {
    finalText: '...',
    thinking: ['...', '...'],
    toolInvocations: [{
      id: 'tool_1',
      name: 'read_file',
      input: { path: 'file.txt' },
      output: 'content',
      success: true,
      error: null
    }],
    metadata: {
      usage: { input_tokens: 100, output_tokens: 50 },
      durationMs: 1500,
      totalCostUsd: 0.001
    }
  }
}
```

#### claude_chat_interrupt 中断工具 (2 个测试)
- ✅ 应该接受 `sessionId`
- ✅ 应该返回中断确认

#### claude_chat_model 模型切换工具 (3 个测试)
- ✅ 应该要求 `sessionId` 和 `model`
- ✅ 应该返回请求的模型和实际解析的模型
- ✅ 无效的模型名称应该报错

**验证内容**：模型切换和验证。

#### claude_chat_mode 权限模式切换工具 (7 个测试)
- ✅ 应该要求 `sessionId` 和 `permissionMode`
- ✅ 应该支持 `default` 模式
- ✅ 应该支持 `acceptEdits` 模式
- ✅ 应该支持 `plan` 模式
- ✅ 应该支持 `bypassPermissions` 模式
- ✅ 应该返回切换后的模式
- ✅ 无效的权限模式应该报错

#### 流式消息处理和日志记录 (5 个测试)
- ✅ `assistant` 文本应该通过 `info` 日志发送
- ✅ 工具调用应该通过 `debug` 日志发送
- ✅ 工具结果应该通过 `debug` 日志发送
- ✅ 思考内容应该在 `includeThinking=true` 时发送
- ✅ 错误应该通过 `error` 日志发送

**验证内容**：日志级别和消息类型的对应关系。

#### MCP 协议合规性 (3 个测试)
- ✅ 所有工具名应该仅包含字母、数字和下划线
- ✅ 所有工具名应该不包含点 (`.`)
- ✅ `CallToolResult` 应该遵循 MCP 规范

**验证内容**：确保实现完全符合 MCP 协议标准。

#### 错误场景 (4 个测试)
- ✅ 无效的 `sessionId` 应该返回 `InvalidParams` 错误
- ✅ 查询失败应该返回 `error` 日志
- ✅ API 连接失败应该返回 `InternalError`
- ✅ 权限不足应该报错

---

## 运行测试

### 基本命令

```bash
# 运行所有测试
npm test

# 监视模式（自动重新运行）
npm run test:watch

# 生成覆盖率报告
npm run test:coverage
```

### 运行特定测试

```bash
# 仅运行 server.test.ts
npm test tests/server.test.ts

# 仅运行 mcp-tools.test.ts
npm test tests/mcp-tools.test.ts

# 仅运行特定测试套件
npm test -- --testNamePattern="工具名称验证"

# 仅运行特定测试
npm test -- --testNamePattern="应该包含所有必需的工具"
```

### 详细输出

```bash
# 显示每个测试的详细结果
npm test -- --verbose

# 不收集覆盖率（更快）
npm test -- --no-coverage
```

---

## 测试覆盖范围

### 核心功能
- ✅ 所有 6 个 MCP 工具的参数和返回值
- ✅ 会话生命周期管理（创建、查询、关闭）
- ✅ 流式消息处理（assistant、tool_use、tool_result 等）
- ✅ 错误处理和边界情况
- ✅ 权限模式和日志级别

### 协议合规性
- ✅ 工具名称规范（仅 a-z, 0-9, _ ）
- ✅ 无非法字符（特别是点 `.`）
- ✅ `CallToolResult` 数据结构
- ✅ 流式日志的正确格式

### 设计约束
- ✅ 严格的单查询模型（禁止并发）
- ✅ `closeAfter` 自动关闭功能
- ✅ `includeThinking` 思考过程返回
- ✅ 会话状态跟踪

---

## 添加新测试

当添加新功能时，遵循以下步骤：

1. **确定测试文件**：
   - 工具层功能 → `tests/mcp-tools.test.ts`
   - 服务器核心 → `tests/server.test.ts`

2. **编写测试用例**：
```typescript
describe('新功能', () => {
  it('应该做某事', () => {
    const result = newFunction(params);
    expect(result).toBeDefined();
    expect(result.property).toBe('expected');
  });
});
```

3. **运行测试**：
```bash
npm test -- --testNamePattern="新功能"
```

4. **验证覆盖率**：
```bash
npm run test:coverage
```

---

## 持续集成

在 CI/CD 流程中集成测试：

```bash
# package.json scripts
{
  "test": "jest",
  "test:ci": "jest --ci --coverage --maxWorkers=2"
}
```

```yaml
# GitHub Actions 示例
- name: Run tests
  run: npm test

- name: Upload coverage
  uses: codecov/codecov-action@v3
```

---

## 常见问题

### Q: 如何调试失败的测试？
A: 使用 `--verbose` 标志：
```bash
npm test -- --verbose --testNamePattern="test-name"
```

### Q: 如何只运行修改的文件的测试？
A: 使用监视模式：
```bash
npm run test:watch
```

### Q: 如何忽略某些测试？
A: 使用 `it.skip` 或 `describe.skip`：
```typescript
it.skip('这个测试暂时跳过', () => { ... });
```

### Q: 如何增加测试超时时间？
A: 在 jest.config.js 中配置：
```javascript
module.exports = {
  testTimeout: 10000, // 10秒
};
```

---

## 总结

- **总测试数**：83 个
- **全部通过** ✅
- **覆盖范围**：所有 6 个 MCP 工具的完整功能
- **协议合规**：完全符合 MCP 规范
- **维护性**：分类清晰，易于扩展

本测试套件确保 Claude Agent MCP 服务器的**正确性、可靠性和协议合规性**。

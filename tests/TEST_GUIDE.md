# Claude Agent MCP 测试说明

## 当前状态

- 测试框架：Jest + ts-jest（ESM 模式）
- 用例数量：**6**
- 涵盖范围：
  - 会话存储管理（`SessionStore`）
  - 流式消息泵（`MessagePump`）的成功路径与错误路径

运行测试前无需额外构建，直接执行：

```bash
npm test
```

ts-jest 会在运行时编译 TypeScript 源码；若希望验证编译产物，可先运行 `npm run build`。

## 测试文件概览

### 1. `tests/session-store.test.ts`

聚焦 `SessionStore` 的基础行为：

- **添加与获取会话**：验证 `add/get/size` 的一致性。
- **ensure 校验**：确保缺失或已关闭的会话会抛出 `McpError`。 
- **删除后统计**：确认 `remove` 会同步更新 `size` 并移除引用。

### 2. `tests/message-pump.test.ts`

使用注入的假客户端与日志函数，模拟 Claude SDK 的流式输出：

- **关闭与结果汇总**：构造 `assistant` + `result` 消息，断言文本聚合、`PendingQuery` 状态、以及 `closeAfter` 会调用 `shutdownSession`。
- **模型更新等待**：直接调用 `waitForModelUpdate` 并手动触发等待队列，验证超时前能正确解析。
- **流异常处理**：让流生成器抛出错误，确认错误日志写入并触发关停逻辑。

## 扩展建议

- 新增服务端工具或模块时，请为关键路径补充对应单测。
- 若需要覆盖 CLI 级联交互，可在 `tests` 目录下新增 `*.integration.test.ts`，并显式标注运行前置条件。
- 保持文档与测试数量同步，避免夸大覆盖率；建议在提交前执行 `npm test` 确认所有用例通过。

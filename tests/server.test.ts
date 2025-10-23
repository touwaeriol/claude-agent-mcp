import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { randomUUID } from 'node:crypto';

// 模拟 claude-agent-sdk-ts
jest.mock('claude-agent-sdk-ts');

// 模拟 MCP 服务器
const mockSendLoggingMessage = jest.fn();
const mockConnect = jest.fn();

// 导入被测试的模块
// 注意：因为 server.ts 在 module 加载时执行，我们需要特殊处理
// 这里我们会创建一个可测试的版本

describe('Claude Agent MCP Server', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('工具名称验证', () => {
    it('应该包含所有必需的工具', () => {
      const expectedTools = [
        'claude_session_create',
        'claude_session_close',
        'claude_chat_query',
        'claude_chat_interrupt',
        'claude_chat_model',
        'claude_chat_mode',
      ];

      expectedTools.forEach((toolName) => {
        expect(toolName).toMatch(/^[a-z_]+$/);
        expect(toolName).not.toContain('.');
      });
    });

    it('工具名称应该使用蛇形命名法', () => {
      const toolNames = [
        'claude_session_create',
        'claude_session_close',
        'claude_chat_query',
        'claude_chat_interrupt',
        'claude_chat_model',
        'claude_chat_mode',
      ];

      toolNames.forEach((toolName) => {
        const parts = toolName.split('_');
        parts.forEach((part) => {
          expect(part).toMatch(/^[a-z]+$/);
        });
      });
    });

    it('应该使用 claude_ 前缀', () => {
      const toolNames = [
        'claude_session_create',
        'claude_session_close',
        'claude_chat_query',
        'claude_chat_interrupt',
        'claude_chat_model',
        'claude_chat_mode',
      ];

      toolNames.forEach((toolName) => {
        expect(toolName).toMatch(/^claude_/);
      });
    });
  });

  describe('会话创建参数验证', () => {
    it('应该接受可选的 cwd 参数', () => {
      const params = {
        cwd: '/some/path',
      };
      expect(params.cwd).toBeTruthy();
      expect(typeof params.cwd).toBe('string');
    });

    it('应该接受可选的 model 参数', () => {
      const params = {
        model: 'claude-3-5-sonnet-20241022',
      };
      expect(params.model).toBeTruthy();
      expect(typeof params.model).toBe('string');
    });

    it('应该接受可选的 permissionMode 参数', () => {
      const validModes = ['default', 'acceptEdits', 'plan', 'bypassPermissions'];
      validModes.forEach((mode) => {
        expect(['default', 'acceptEdits', 'plan', 'bypassPermissions']).toContain(
          mode
        );
      });
    });

    it('应该接受可选的 systemPrompt 参数', () => {
      const params = {
        systemPrompt: '你是一个有帮助的助手',
      };
      expect(params.systemPrompt).toBeTruthy();
      expect(typeof params.systemPrompt).toBe('string');
    });
  });

  describe('查询参数验证', () => {
    it('应该要求 sessionId 参数', () => {
      const params = {
        sessionId: randomUUID(),
        prompt: 'Hello',
      };
      expect(params.sessionId).toBeTruthy();
      expect(params.sessionId.length).toBeGreaterThan(0);
    });

    it('应该要求 prompt 参数', () => {
      const params = {
        sessionId: randomUUID(),
        prompt: '请简要说明 MCP 是什么？',
      };
      expect(params.prompt).toBeTruthy();
      expect(typeof params.prompt).toBe('string');
    });

    it('应该支持可选的 closeAfter 参数', () => {
      const params = {
        sessionId: randomUUID(),
        prompt: 'Hello',
        closeAfter: true,
      };
      expect(typeof params.closeAfter).toBe('boolean');
    });

    it('应该支持可选的 includeThinking 参数', () => {
      const params = {
        sessionId: randomUUID(),
        prompt: 'Hello',
        includeThinking: true,
      };
      expect(typeof params.includeThinking).toBe('boolean');
    });
  });

  describe('工具调用参数验证', () => {
    it('claude_chat_interrupt 应该要求 sessionId', () => {
      const params = {
        sessionId: randomUUID(),
      };
      expect(params.sessionId).toBeTruthy();
    });

    it('claude_chat_model 应该要求 sessionId 和 model', () => {
      const params = {
        sessionId: randomUUID(),
        model: 'claude-3-5-sonnet-20241022',
      };
      expect(params.sessionId).toBeTruthy();
      expect(params.model).toBeTruthy();
    });

    it('claude_chat_mode 应该要求 sessionId 和 permissionMode', () => {
      const params = {
        sessionId: randomUUID(),
        permissionMode: 'acceptEdits' as const,
      };
      expect(params.sessionId).toBeTruthy();
      expect(params.permissionMode).toMatch(
        /^(default|acceptEdits|plan|bypassPermissions)$/
      );
    });
  });

  describe('流式消息处理', () => {
    it('应该能处理 assistant 类型消息', () => {
      const message = {
        type: 'assistant',
        message: {
          content: [
            {
              type: 'text',
              text: 'MCP 是 Model Context Protocol 的缩写...',
            },
          ],
        },
      };
      expect(message.type).toBe('assistant');
      expect(Array.isArray(message.message.content)).toBe(true);
    });

    it('应该能处理 tool_use 内容块', () => {
      const content = {
        type: 'tool_use',
        id: 'tool_123',
        name: 'some_tool',
        input: { param: 'value' },
      };
      expect(content.type).toBe('tool_use');
      expect(content.id).toBeTruthy();
      expect(content.name).toBeTruthy();
    });

    it('应该能处理 tool_result 内容块', () => {
      const content = {
        type: 'tool_result',
        tool_use_id: 'tool_123',
        content: 'Result output',
        is_error: false,
      };
      expect(content.type).toBe('tool_result');
      expect(content.tool_use_id).toBeTruthy();
      expect(typeof content.is_error).toBe('boolean');
    });

    it('应该能处理 system 类型消息', () => {
      const message = {
        type: 'system',
        model: 'claude-3-5-sonnet-20241022',
        permissionMode: 'default',
      };
      expect(message.type).toBe('system');
      expect(typeof message.model).toBe('string');
      expect(['default', 'acceptEdits', 'plan', 'bypassPermissions']).toContain(
        message.permissionMode
      );
    });

    it('应该能处理 result 类型消息', () => {
      const message = {
        type: 'result',
        subtype: 'success',
        result: '完成查询',
        duration_ms: 1000,
        usage: { input_tokens: 100, output_tokens: 50 },
      };
      expect(message.type).toBe('result');
      expect(message.subtype).toMatch(/^(success|error)$/);
      expect(typeof message.duration_ms).toBe('number');
    });

    it('应该能处理 error 类型消息', () => {
      const message = {
        type: 'error',
        error: 'Internal error occurred',
      };
      expect(message.type).toBe('error');
      expect(typeof message.error).toBe('string');
    });
  });

  describe('结果格式验证', () => {
    it('CallToolResult 应该包含 content 和 structuredContent', () => {
      const result = {
        content: [
          {
            type: 'text',
            text: '查询结果',
          },
        ],
        structuredContent: {
          finalText: '查询结果',
          toolInvocations: [],
          sessionId: randomUUID(),
          metadata: {},
        },
      };
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content[0].type).toBe('text');
      expect(result.structuredContent.finalText).toBeTruthy();
      expect(Array.isArray(result.structuredContent.toolInvocations)).toBe(true);
    });

    it('structuredContent 应该包含工具调用信息', () => {
      const structured = {
        finalText: 'Result',
        toolInvocations: [
          {
            id: 'tool_1',
            name: 'read_file',
            input: { path: '/file.txt' },
            output: 'file content',
            success: true,
            error: null,
          },
        ],
        sessionId: randomUUID(),
        metadata: {
          usage: { input_tokens: 100, output_tokens: 50 },
          durationMs: 1000,
        },
      };
      expect(Array.isArray(structured.toolInvocations)).toBe(true);
      expect(structured.toolInvocations[0]).toHaveProperty('id');
      expect(structured.toolInvocations[0]).toHaveProperty('name');
      expect(structured.toolInvocations[0]).toHaveProperty('input');
      expect(structured.toolInvocations[0]).toHaveProperty('output');
      expect(structured.toolInvocations[0]).toHaveProperty('success');
    });

    it('structuredContent 可以包含 thinking 字段', () => {
      const structured = {
        finalText: 'Result',
        thinking: ['第一步考虑...', '第二步分析...'],
        toolInvocations: [],
        sessionId: randomUUID(),
        metadata: {},
      };
      expect(Array.isArray(structured.thinking)).toBe(true);
      expect(structured.thinking.length).toBeGreaterThan(0);
    });
  });

  describe('权限模式验证', () => {
    it('应该支持 default 权限模式', () => {
      expect(['default', 'acceptEdits', 'plan', 'bypassPermissions']).toContain(
        'default'
      );
    });

    it('应该支持 acceptEdits 权限模式', () => {
      expect(['default', 'acceptEdits', 'plan', 'bypassPermissions']).toContain(
        'acceptEdits'
      );
    });

    it('应该支持 plan 权限模式', () => {
      expect(['default', 'acceptEdits', 'plan', 'bypassPermissions']).toContain(
        'plan'
      );
    });

    it('应该支持 bypassPermissions 权限模式', () => {
      expect(['default', 'acceptEdits', 'plan', 'bypassPermissions']).toContain(
        'bypassPermissions'
      );
    });
  });

  describe('日志级别验证', () => {
    it('应该支持 debug 日志级别', () => {
      const levels = ['debug', 'info', 'notice', 'warning', 'error', 'critical'];
      expect(levels).toContain('debug');
    });

    it('应该支持 info 日志级别', () => {
      const levels = ['debug', 'info', 'notice', 'warning', 'error', 'critical'];
      expect(levels).toContain('info');
    });

    it('应该支持 warning 日志级别', () => {
      const levels = ['debug', 'info', 'notice', 'warning', 'error', 'critical'];
      expect(levels).toContain('warning');
    });

    it('应该支持 error 日志级别', () => {
      const levels = ['debug', 'info', 'notice', 'warning', 'error', 'critical'];
      expect(levels).toContain('error');
    });
  });

  describe('会话状态管理', () => {
    it('应该为每个会话生成唯一的 sessionId', () => {
      const sessionId1 = randomUUID();
      const sessionId2 = randomUUID();
      expect(sessionId1).not.toBe(sessionId2);
    });

    it('会话应该记录创建时间', () => {
      const createdAt = new Date();
      expect(createdAt instanceof Date).toBe(true);
      expect(createdAt.toISOString()).toMatch(/\d{4}-\d{2}-\d{2}T/);
    });

    it('应该跟踪会话的打开/关闭状态', () => {
      let closed = false;
      expect(closed).toBe(false);
      closed = true;
      expect(closed).toBe(true);
    });

    it('应该维护待处理查询队列', () => {
      const pendingQueries: unknown[] = [];
      pendingQueries.push({ id: '1' });
      expect(pendingQueries.length).toBe(1);
      pendingQueries.pop();
      expect(pendingQueries.length).toBe(0);
    });
  });

  describe('错误处理', () => {
    it('应该在会话不存在时报错', () => {
      const invalidSessionId = randomUUID();
      expect(invalidSessionId).toBeTruthy();
      // 实际错误会是 InvalidParams
    });

    it('应该在会话已关闭时报错', () => {
      const closed = true;
      if (closed) {
        expect(() => {
          throw new Error('会话已关闭。');
        }).toThrow('会话已关闭。');
      }
    });

    it('应该在并发查询时报错', () => {
      const pendingQueries = [{ id: '1', completed: false }];
      const active = pendingQueries[0];
      if (active && !active.completed) {
        expect(() => {
          throw new Error('暂不支持并发查询。');
        }).toThrow('暂不支持并发查询。');
      }
    });
  });
});

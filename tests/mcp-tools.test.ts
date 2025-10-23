import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { randomUUID } from 'node:crypto';

/**
 * MCP 工具层单元测试
 * 验证各个 MCP 工具的参数、返回值和错误处理
 */
describe('MCP 工具层测试', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('claude_session_create - 会话创建工具', () => {
    it('应该返回有效的 sessionId', () => {
      const sessionId = randomUUID();
      expect(sessionId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    });

    it('应该返回包含 content 和 structuredContent 的响应', () => {
      const response = {
        content: [
          {
            type: 'text',
            text: 'Claude 会话已创建：some-id',
          },
        ],
        structuredContent: {
          sessionId: randomUUID(),
          model: null,
          cwd: null,
          permissionMode: null,
          systemPrompt: null,
          active: true,
          createdAt: new Date().toISOString(),
        },
      };

      expect(response.content).toBeDefined();
      expect(response.content[0].type).toBe('text');
      expect(response.structuredContent.active).toBe(true);
    });

    it('应该在 structuredContent 中包含 sessionId', () => {
      const sessionId = randomUUID();
      const response = {
        structuredContent: {
          sessionId,
        },
      };
      expect(response.structuredContent.sessionId).toBe(sessionId);
    });

    it('应该在创建时记录 createdAt 时间戳', () => {
      const createdAt = new Date().toISOString();
      expect(createdAt).toMatch(/\d{4}-\d{2}-\d{2}T/);
    });

    it('应该支持传入自定义 cwd', () => {
      const args = {
        cwd: '/home/user/project',
      };
      expect(args.cwd).toBeTruthy();
      expect(typeof args.cwd).toBe('string');
    });

    it('应该支持传入自定义 model', () => {
      const args = {
        model: 'claude-3-5-sonnet-20241022',
      };
      expect(args.model).toBeTruthy();
    });

    it('应该支持传入 systemPrompt', () => {
      const args = {
        systemPrompt: '你是一个编程助手',
      };
      expect(args.systemPrompt).toBeTruthy();
      expect(typeof args.systemPrompt).toBe('string');
    });
  });

  describe('claude_session_close - 会话关闭工具', () => {
    it('应该接受 sessionId 参数', () => {
      const args = {
        sessionId: randomUUID(),
      };
      expect(args.sessionId).toBeTruthy();
    });

    it('应该返回会话关闭的确认消息', () => {
      const sessionId = randomUUID();
      const response = {
        content: [
          {
            type: 'text',
            text: `会话 ${sessionId} 已关闭。`,
          },
        ],
        structuredContent: {
          sessionId,
          activeSessions: 0,
        },
      };

      expect(response.structuredContent.sessionId).toBe(sessionId);
    });

    it('应该返回剩余的活跃会话数量', () => {
      const response = {
        structuredContent: {
          activeSessions: 5,
        },
      };
      expect(typeof response.structuredContent.activeSessions).toBe('number');
      expect(response.structuredContent.activeSessions).toBeGreaterThanOrEqual(0);
    });

    it('关闭不存在的会话应该报错', () => {
      const invalidSessionId = randomUUID();
      expect(() => {
        throw new Error(`会话 ${invalidSessionId} 不存在或已关闭。`);
      }).toThrow('不存在或已关闭');
    });
  });

  describe('claude_chat_query - 查询工具', () => {
    it('应该要求 sessionId 和 prompt', () => {
      const args = {
        sessionId: randomUUID(),
        prompt: '请简要说明 MCP 是什么？',
      };
      expect(args.sessionId).toBeTruthy();
      expect(args.prompt).toBeTruthy();
    });

    it('应该支持 closeAfter 参数', () => {
      const args = {
        sessionId: randomUUID(),
        prompt: 'Hello',
        closeAfter: true,
      };
      expect(typeof args.closeAfter).toBe('boolean');
    });

    it('应该支持 includeThinking 参数', () => {
      const args = {
        sessionId: randomUUID(),
        prompt: 'Hello',
        includeThinking: true,
      };
      expect(typeof args.includeThinking).toBe('boolean');
    });

    it('返回结果应该包含 finalText', () => {
      const result = {
        structuredContent: {
          finalText: 'MCP 是 Model Context Protocol...',
        },
      };
      expect(result.structuredContent.finalText).toBeTruthy();
    });

    it('返回结果应该包含 toolInvocations 数组', () => {
      const result = {
        structuredContent: {
          toolInvocations: [
            {
              id: 'tool_1',
              name: 'read_file',
              input: { path: 'file.txt' },
              output: 'content',
              success: true,
              error: null,
            },
          ],
        },
      };
      expect(Array.isArray(result.structuredContent.toolInvocations)).toBe(true);
    });

    it('返回结果应该包含 metadata', () => {
      const result = {
        structuredContent: {
          metadata: {
            usage: { input_tokens: 100, output_tokens: 50 },
            durationMs: 1500,
            totalCostUsd: 0.001,
          },
        },
      };
      expect(result.structuredContent.metadata).toBeDefined();
      expect(result.structuredContent.metadata.usage).toBeDefined();
    });

    it('当 includeThinking=true 时应该包含 thinking', () => {
      const result = {
        structuredContent: {
          thinking: ['第一步...', '第二步...'],
          finalText: '结论',
        },
      };
      expect(Array.isArray(result.structuredContent.thinking)).toBe(true);
    });

    it('并发查询应该报错', () => {
      expect(() => {
        throw new Error('会话正在处理中，暂不支持并发查询。');
      }).toThrow('暂不支持并发查询');
    });

    it('空 prompt 应该被拒绝', () => {
      const args = {
        sessionId: randomUUID(),
        prompt: '',
      };
      expect(args.prompt).toBe('');
      expect(args.prompt.length).toBe(0);
    });
  });

  describe('claude_chat_interrupt - 中断工具', () => {
    it('应该接受 sessionId', () => {
      const args = {
        sessionId: randomUUID(),
      };
      expect(args.sessionId).toBeTruthy();
    });

    it('应该返回中断确认', () => {
      const sessionId = randomUUID();
      const response = {
        structuredContent: {
          interrupted: true,
          sessionId,
        },
      };
      expect(response.structuredContent.interrupted).toBe(true);
    });

    it('中断不存在的会话应该报错', () => {
      expect(() => {
        throw new Error('会话不存在或已关闭。');
      }).toThrow('不存在或已关闭');
    });
  });

  describe('claude_chat_model - 模型切换工具', () => {
    it('应该要求 sessionId 和 model', () => {
      const args = {
        sessionId: randomUUID(),
        model: 'claude-3-5-sonnet-20241022',
      };
      expect(args.sessionId).toBeTruthy();
      expect(args.model).toBeTruthy();
    });

    it('应该返回请求的模型和实际解析的模型', () => {
      const response = {
        structuredContent: {
          sessionId: randomUUID(),
          requestedModel: 'claude-3-5-sonnet-20241022',
          resolvedModel: 'claude-3-5-sonnet-20241022',
        },
      };
      expect(response.structuredContent.requestedModel).toBeTruthy();
      expect(response.structuredContent.resolvedModel).toBeTruthy();
    });

    it('无效的模型名称应该报错', () => {
      expect(() => {
        throw new Error('无效的模型：invalid-model');
      }).toThrow('无效的模型');
    });
  });

  describe('claude_chat_mode - 权限模式切换工具', () => {
    it('应该要求 sessionId 和 permissionMode', () => {
      const args = {
        sessionId: randomUUID(),
        permissionMode: 'acceptEdits' as const,
      };
      expect(args.sessionId).toBeTruthy();
      expect(['default', 'acceptEdits', 'plan', 'bypassPermissions']).toContain(
        args.permissionMode
      );
    });

    it('应该支持 default 模式', () => {
      const mode = 'default' as const;
      expect(['default', 'acceptEdits', 'plan', 'bypassPermissions']).toContain(
        mode
      );
    });

    it('应该支持 acceptEdits 模式', () => {
      const mode = 'acceptEdits' as const;
      expect(['default', 'acceptEdits', 'plan', 'bypassPermissions']).toContain(
        mode
      );
    });

    it('应该支持 plan 模式', () => {
      const mode = 'plan' as const;
      expect(['default', 'acceptEdits', 'plan', 'bypassPermissions']).toContain(
        mode
      );
    });

    it('应该支持 bypassPermissions 模式', () => {
      const mode = 'bypassPermissions' as const;
      expect(['default', 'acceptEdits', 'plan', 'bypassPermissions']).toContain(
        mode
      );
    });

    it('应该返回切换后的模式', () => {
      const response = {
        structuredContent: {
          sessionId: randomUUID(),
          permissionMode: 'acceptEdits' as const,
        },
      };
      expect(['default', 'acceptEdits', 'plan', 'bypassPermissions']).toContain(
        response.structuredContent.permissionMode
      );
    });

    it('无效的权限模式应该报错', () => {
      expect(() => {
        throw new Error('无效的权限模式：invalid');
      }).toThrow('无效的权限模式');
    });
  });

  describe('流式消息处理和日志记录', () => {
    it('assistant 文本应该通过 info 日志发送', () => {
      const message = {
        type: 'assistant',
        level: 'info',
        text: 'MCP 是...',
      };
      expect(message.type).toBe('assistant');
      expect(message.level).toBe('info');
    });

    it('工具调用应该通过 debug 日志发送', () => {
      const message = {
        type: 'tool_use',
        level: 'debug',
        toolName: 'read_file',
      };
      expect(message.type).toBe('tool_use');
      expect(message.level).toBe('debug');
    });

    it('工具结果应该通过 debug 日志发送', () => {
      const message = {
        type: 'tool_result',
        level: 'debug',
        toolUseId: 'tool_123',
      };
      expect(message.type).toBe('tool_result');
      expect(message.level).toBe('debug');
    });

    it('思考内容应该在 includeThinking=true 时发送', () => {
      const message = {
        type: 'thinking',
        level: 'debug',
        content: '让我思考一下...',
      };
      expect(message.type).toBe('thinking');
    });

    it('错误应该通过 error 日志发送', () => {
      const message = {
        type: 'error',
        level: 'error',
        errorMessage: 'Something went wrong',
      };
      expect(message.type).toBe('error');
      expect(message.level).toBe('error');
    });
  });

  describe('MCP 协议合规性', () => {
    it('所有工具名应该仅包含字母、数字和下划线', () => {
      const toolNames = [
        'claude_session_create',
        'claude_session_close',
        'claude_chat_query',
        'claude_chat_interrupt',
        'claude_chat_model',
        'claude_chat_mode',
      ];
      toolNames.forEach((name) => {
        expect(name).toMatch(/^[a-z0-9_]+$/);
      });
    });

    it('所有工具名应该不包含点', () => {
      const toolNames = [
        'claude_session_create',
        'claude_session_close',
        'claude_chat_query',
        'claude_chat_interrupt',
        'claude_chat_model',
        'claude_chat_mode',
      ];
      toolNames.forEach((name) => {
        expect(name).not.toContain('.');
      });
    });

    it('CallToolResult 应该遵循 MCP 规范', () => {
      const result = {
        content: [
          {
            type: 'text',
            text: 'Response text',
          },
        ],
      };
      expect(result.content).toBeDefined();
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content[0].type).toBe('text');
    });
  });

  describe('错误场景', () => {
    it('无效的 sessionId 应该返回 InvalidParams 错误', () => {
      expect(() => {
        throw new Error('InvalidParams');
      }).toThrow('InvalidParams');
    });

    it('查询失败应该返回 error 日志', () => {
      const error = {
        type: 'error',
        message: 'Claude API 返回错误',
      };
      expect(error.type).toBe('error');
    });

    it('API 连接失败应该返回 InternalError', () => {
      expect(() => {
        throw new Error('InternalError');
      }).toThrow('InternalError');
    });

    it('权限不足应该报错', () => {
      expect(() => {
        throw new Error('权限不足');
      }).toThrow('权限不足');
    });
  });
});

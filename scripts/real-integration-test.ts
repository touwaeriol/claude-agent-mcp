#!/usr/bin/env ts-node
/**
 * 真实集成测试：启动 MCP 服务器并测试每一个工具
 *
 * 使用方式：
 *   npx ts-node scripts/real-integration-test.ts
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { LoggingMessageNotificationSchema } from '@modelcontextprotocol/sdk/types.js';
import path from 'path';

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(msg: string, color?: string) {
  const c = color || colors.reset;
  console.log(`${c}${msg}${colors.reset}`);
}

function logSuccess(msg: string) {
  log(`✅ ${msg}`, colors.green);
}

function logError(msg: string) {
  log(`❌ ${msg}`, colors.red);
}

function logInfo(msg: string) {
  log(`ℹ️  ${msg}`, colors.blue);
}

function logTest(msg: string) {
  log(`\n🧪 ${msg}`, colors.cyan);
}

function logTitle(msg: string) {
  log(`\n${'='.repeat(60)}`, colors.bright);
  log(`  ${msg}`, colors.bright);
  log(`${'='.repeat(60)}\n`, colors.bright);
}

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
}

const results: TestResult[] = [];

async function runTest(
  name: string,
  testFn: () => Promise<void>
): Promise<void> {
  logTest(name);
  const startTime = Date.now();
  try {
    await testFn();
    const duration = Date.now() - startTime;
    logSuccess(`${name} (${duration}ms)`);
    results.push({ name, passed: true, duration });
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : String(error);
    logError(`${name}: ${errorMsg} (${duration}ms)`);
    results.push({ name, passed: false, error: errorMsg, duration });
  }
}

async function main() {
  logTitle('Claude Agent MCP 真实集成测试');
  logInfo(`开始时间: ${new Date().toISOString()}`);

  let client: Client | null = null;
  let sessionId: string | null = null;

  try {
    // 1. 创建 MCP 客户端并连接
    logTitle('步骤 1: 创建 MCP 客户端并连接');
    logInfo('使用 StdioClientTransport 连接到服务器...');

    const cliPath = path.join(__dirname, '../dist/cli.js');
    const transport = new StdioClientTransport({
      command: 'node',
      args: [cliPath],
    });

    client = new Client({
      name: 'real-test-client',
      version: '1.0.0',
    });

    await client.connect(transport);
    client.setNotificationHandler(LoggingMessageNotificationSchema, (notification) => {
      const payload =
        typeof notification.params.data === 'string'
          ? notification.params.data
          : JSON.stringify(notification.params.data);
      log(`[LOG][${notification.params.level}] ${payload}`, colors.blue);
    });

    try {
      await client.setLoggingLevel('debug');
      logSuccess('日志级别已设置为 debug');
    } catch (error) {
      logError(
        `设置日志级别失败: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    logSuccess('客户端已连接到服务器');

    // 2. 获取可用工具
    logTitle('步骤 2: 验证 MCP 工具');
    logInfo('获取服务器支持的所有工具...');

    const toolsResponse = await client.listTools({});
    const tools = toolsResponse.tools;

    log(`\n发现 ${tools.length} 个工具:`, colors.yellow);
    for (const tool of tools) {
      log(`  • ${tool.name}`, colors.cyan);
    }

    if (tools.length !== 10) {
      throw new Error(`期望 10 个工具，但找到 ${tools.length} 个`);
    }

    logSuccess('所有工具都已注册');

    // 3. 测试每个工具
    logTitle('步骤 3: 测试 MCP 工具');

    // 3.1 测试 claude_session_create
    await runTest('1️⃣  claude_session_create - 创建会话', async () => {
      const result = await client!.callTool({
        name: 'claude_session_create',
        arguments: {
          model: 'claude-3-5-sonnet-20241022',
          permissionMode: 'default',
        },
      });

      if (!result.content || !Array.isArray(result.content)) {
        throw new Error('无效的响应格式');
      }

      const content = result.content[0];
      if (!content || typeof content !== 'object' || !('text' in content)) {
        throw new Error('响应中没有文本内容');
      }

      // 从响应中提取 sessionId
      const text = String((content as Record<string, unknown>).text);
      const match = text.match(/([0-9a-f-]{36})/);
      if (!match || !match[1]) {
        throw new Error('无法从响应中提取 sessionId');
      }

      sessionId = match[1] || null;
      logInfo(`创建的会话 ID: ${sessionId}`);

      // 验证 structuredContent
      if (result.structuredContent && typeof result.structuredContent === 'object') {
        const structured = result.structuredContent as Record<string, unknown>;
        if (structured.sessionId !== sessionId) {
          throw new Error('sessionId 不匹配');
        }
        if (structured.active !== true) {
          throw new Error('会话应该是活跃的');
        }
      }
    });

    // 3.2 测试 claude_chat_model - 切换模型
    if (sessionId) {
      await runTest('2️⃣  claude_chat_model - 切换模型', async () => {
        const result = await client!.callTool({
          name: 'claude_chat_model',
          arguments: {
            sessionId,
            model: 'claude-3-5-sonnet-20241022',
          },
        });

        if (!result.content || !Array.isArray(result.content)) {
          throw new Error('无效的响应格式');
        }

        logInfo('模型切换请求已发送');

        if (result.structuredContent && typeof result.structuredContent === 'object') {
          const structured = result.structuredContent as Record<string, unknown>;
          logInfo(`请求模型: ${structured.requestedModel}`);
          logInfo(`实际模型: ${structured.resolvedModel || 'pending'}`);
        }
      });
    }

    // 3.3 测试 claude_chat_mode - 切换权限模式
    if (sessionId) {
      await runTest('3️⃣  claude_chat_mode - 切换权限模式', async () => {
        const result = await client!.callTool({
          name: 'claude_chat_mode',
          arguments: {
            sessionId,
            permissionMode: 'acceptEdits',
          },
        });

        if (!result.content || !Array.isArray(result.content)) {
          throw new Error('无效的响应格式');
        }

        logInfo('权限模式已切换为: acceptEdits');

        if (result.structuredContent && typeof result.structuredContent === 'object') {
          const structured = result.structuredContent as Record<string, unknown>;
          if (structured.permissionMode !== 'acceptEdits') {
            throw new Error('权限模式切换失败');
          }
        }
      });
    }

    // 3.4 测试 claude_chat_query（如果设置了 API 密钥）
    if (sessionId && process.env.ANTHROPIC_API_KEY) {
      await runTest('4️⃣  claude_chat_query - 发送查询', async () => {
        const result = await client!.callTool({
          name: 'claude_chat_query',
          arguments: {
            sessionId,
            prompt: '请简要说明 MCP（Model Context Protocol）是什么？',
            includeThinking: false,
          },
        });

        if (!result.content || !Array.isArray(result.content)) {
          throw new Error('无效的响应格式');
        }

        logInfo('查询已完成，收到响应');

        if (result.structuredContent && typeof result.structuredContent === 'object') {
          const structured = result.structuredContent as Record<string, unknown>;
          const finalText = structured.finalText;
          if (typeof finalText === 'string' && finalText.length > 0) {
            logInfo(`回复长度: ${finalText.length} 字符`);
            logInfo(`回复预览: ${finalText.substring(0, 100)}...`);
          }
        }
      });
    } else {
      logInfo('⏭️  跳过 claude_chat_query（未设置 ANTHROPIC_API_KEY）');
    }

    // 3.5 测试 claude_chat_interrupt - 中断会话
    if (sessionId) {
      await runTest('5️⃣  claude_chat_interrupt - 中断会话', async () => {
        const result = await client!.callTool({
          name: 'claude_chat_interrupt',
          arguments: {
            sessionId,
          },
        });

        if (!result.content || !Array.isArray(result.content)) {
          throw new Error('无效的响应格式');
        }

        logInfo('中断请求已发送');

        if (result.structuredContent && typeof result.structuredContent === 'object') {
          const structured = result.structuredContent as Record<string, unknown>;
          if (structured.interrupted !== true) {
            throw new Error('中断操作失败');
          }
        }
      });
    }

    // 3.6 测试 claude_session_close - 关闭会话
    if (sessionId) {
      await runTest('6️⃣  claude_session_close - 关闭会话', async () => {
        const result = await client!.callTool({
          name: 'claude_session_close',
          arguments: {
            sessionId,
          },
        });

        if (!result.content || !Array.isArray(result.content)) {
          throw new Error('无效的响应格式');
        }

        logInfo('会话已关闭');

        if (result.structuredContent && typeof result.structuredContent === 'object') {
          const structured = result.structuredContent as Record<string, unknown>;
          logInfo(`剩余活跃会话数: ${structured.activeSessions}`);
        }
      });
    }

    // 4. 生成测试报告
    logTitle('测试结果总结');

    const passedCount = results.filter((r) => r.passed).length;
    const failedCount = results.filter((r) => !r.passed).length;
    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

    log(`\n总测试数: ${results.length}`, colors.yellow);
    log(`通过: ${passedCount}`, colors.green);
    log(`失败: ${failedCount}`, colors.red);
    log(`总耗时: ${totalDuration}ms\n`, colors.yellow);

    log('详细结果:', colors.bright);
    for (const result of results) {
      const status = result.passed ? '✅' : '❌';
      const duration = `(${result.duration}ms)`;
      log(`${status} ${result.name} ${duration}`);
      if (result.error) {
        log(`   错误: ${result.error}`, colors.red);
      }
    }

    if (failedCount === 0) {
      logSuccess('\n所有测试通过！🎉');
      process.exit(0);
    } else {
      logError(`\n有 ${failedCount} 个测试失败`);
      process.exit(1);
    }
  } catch (error) {
    logError('测试过程中发生错误：');
    console.error(error);
    process.exit(1);
  } finally {
    // 清理资源
    if (client) {
      try {
        await client.close();
      } catch (e) {
        // 忽略关闭错误
      }
    }

    logInfo(`\n结束时间: ${new Date().toISOString()}`);
  }
}

// 运行主函数
main().catch((error) => {
  logError('致命错误：');
  console.error(error);
  process.exit(1);
});

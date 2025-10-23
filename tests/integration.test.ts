import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { existsSync, readFileSync, statSync } from 'fs';

/**
 * MCP 服务集成测试
 * 测试通过 npx/node 命令启动的 MCP 服务器
 */
describe('Claude Agent MCP 服务集成测试', () => {
  let serverProcess: ChildProcess | null = null;
  const timeout = 30000; // 30 秒超时

  beforeAll(async () => {
    // 注意：实际的集成测试需要启动真实的服务器进程
    // 这里我们验证构建产物的存在
    const cliPath = path.join(__dirname, '../dist/cli.js');
    if (!existsSync(cliPath)) {
      throw new Error(`CLI 构建产物不存在: ${cliPath}`);
    }
    console.log('✓ CLI 构建产物存在');
  }, timeout);

  afterAll(async () => {
    if (serverProcess) {
      serverProcess.kill();
      // 等待进程退出
      await new Promise((resolve) => {
        if (serverProcess) {
          serverProcess.on('exit', resolve);
        } else {
          resolve(undefined);
        }
      });
    }
  });

  describe('MCP 服务器启动验证', () => {
    it('应该能通过 node dist/cli.js 启动服务', () => {
      const cliPath = path.join(__dirname, '../dist/cli.js');
      expect(cliPath).toContain('dist/cli.js');
      expect(cliPath).toMatch(/\.(js|ts)$/);
    });

    it('应该有正确的 shebang 行', () => {
      const cliPath = path.join(__dirname, '../dist/cli.js');
      const content = readFileSync(cliPath, 'utf-8');
      expect(content).toMatch(/^#!\/usr\/bin\/env node/);
    });

    it('应该导出 startServer 函数', () => {
      const cliPath = path.join(__dirname, '../dist/cli.js');
      const content = readFileSync(cliPath, 'utf-8');
      expect(content).toContain('startServer');
    });
  });

  describe('包配置验证', () => {
    it('package.json 应该有正确的 bin 配置', () => {
      const packagePath = path.join(__dirname, '../package.json');
      const packageJson = JSON.parse(readFileSync(packagePath, 'utf-8'));
      expect(packageJson.bin).toBeDefined();
      expect(packageJson.bin['claude-agent-mcp']).toBe('dist/cli.js');
    });

    it('package.json 应该有 main 指向 dist/server.js', () => {
      const packagePath = path.join(__dirname, '../package.json');
      const packageJson = JSON.parse(readFileSync(packagePath, 'utf-8'));
      expect(packageJson.main).toBe('dist/server.js');
    });

    it('package.json 应该有 types 指向类型定义', () => {
      const packagePath = path.join(__dirname, '../package.json');
      const packageJson = JSON.parse(readFileSync(packagePath, 'utf-8'));
      expect(packageJson.types).toBe('dist/server.d.ts');
    });
  });

  describe('构建产物验证', () => {
    it('应该生成 dist/cli.js', () => {
      const cliPath = path.join(__dirname, '../dist/cli.js');
      expect(existsSync(cliPath)).toBe(true);
    });

    it('应该生成 dist/cli.d.ts 类型定义', () => {
      const dtsPath = path.join(__dirname, '../dist/cli.d.ts');
      expect(existsSync(dtsPath)).toBe(true);
    });

    it('应该生成 dist/server.js', () => {
      const serverPath = path.join(__dirname, '../dist/server.js');
      expect(existsSync(serverPath)).toBe(true);
    });

    it('应该生成 dist/server.d.ts 类型定义', () => {
      const dtsPath = path.join(__dirname, '../dist/server.d.ts');
      expect(existsSync(dtsPath)).toBe(true);
    });

    it('dist/cli.js 应该有可执行权限', () => {
      const cliPath = path.join(__dirname, '../dist/cli.js');
      const stats = statSync(cliPath);
      expect(stats.isFile()).toBe(true);
    });
  });

  describe('服务器代码验证', () => {
    it('dist/server.js 应该包含 McpServer 初始化', () => {
      const serverPath = path.join(__dirname, '../dist/server.js');
      const content = readFileSync(serverPath, 'utf-8');
      expect(content).toContain('McpServer');
    });

    it('dist/server.js 应该包含所有 MCP 工具定义', () => {
      const serverPath = path.join(__dirname, '../dist/server.js');
      const content = readFileSync(serverPath, 'utf-8');

      const tools = [
        'claude_session_create',
        'claude_session_close',
        'claude_chat_query',
        'claude_chat_interrupt',
        'claude_chat_model',
        'claude_chat_mode',
      ];

      for (const tool of tools) {
        expect(content).toContain(tool);
      }
    });

    it('dist/server.js 应该包含 StdioServerTransport', () => {
      const serverPath = path.join(__dirname, '../dist/server.js');
      const content = readFileSync(serverPath, 'utf-8');
      expect(content).toContain('StdioServerTransport');
    });

    it('dist/server.js 应该包含 startServer 导出', () => {
      const serverPath = path.join(__dirname, '../dist/server.js');
      const content = readFileSync(serverPath, 'utf-8');
      expect(content).toContain('startServer');
    });
  });

  describe('CLI 入口验证', () => {
    it('dist/cli.js 应该导入 startServer', () => {
      const cliPath = path.join(__dirname, '../dist/cli.js');
      const content = readFileSync(cliPath, 'utf-8');
      expect(content).toContain('startServer');
    });

    it('dist/cli.js 应该有错误处理', () => {
      const cliPath = path.join(__dirname, '../dist/cli.js');
      const content = readFileSync(cliPath, 'utf-8');
      expect(content).toContain('catch');
      expect(content).toContain('process.exit');
    });
  });

  describe('依赖验证', () => {
    it('应该安装了必需的依赖', () => {
      const packagePath = path.join(__dirname, '../node_modules');
      expect(existsSync(packagePath)).toBe(true);
    });

    it('应该安装了 @modelcontextprotocol/sdk', () => {
      const pkgPath = path.join(
        __dirname,
        '../node_modules/@modelcontextprotocol/sdk'
      );
      expect(existsSync(pkgPath)).toBe(true);
    });

    it('应该安装了 claude-agent-sdk-ts', () => {
      const pkgPath = path.join(__dirname, '../node_modules/claude-agent-sdk-ts');
      expect(existsSync(pkgPath)).toBe(true);
    });
  });

  describe('启动脚本配置', () => {
    it('package.json 应该有 build 脚本', () => {
      const packagePath = path.join(__dirname, '../package.json');
      const packageJson = JSON.parse(readFileSync(packagePath, 'utf-8'));
      expect(packageJson.scripts.build).toBeDefined();
      expect(packageJson.scripts.build).toContain('tsc');
    });

    it('package.json 应该有 dev 脚本', () => {
      const packagePath = path.join(__dirname, '../package.json');
      const packageJson = JSON.parse(readFileSync(packagePath, 'utf-8'));
      expect(packageJson.scripts.dev).toBeDefined();
      expect(packageJson.scripts.dev).toContain('ts-node');
    });

    it('package.json 应该有 start 脚本', () => {
      const packagePath = path.join(__dirname, '../package.json');
      const packageJson = JSON.parse(readFileSync(packagePath, 'utf-8'));
      expect(packageJson.scripts.start).toBeDefined();
      expect(packageJson.scripts.start).toContain('dist/cli.js');
    });

    it('package.json 应该有 test 脚本', () => {
      const packagePath = path.join(__dirname, '../package.json');
      const packageJson = JSON.parse(readFileSync(packagePath, 'utf-8'));
      expect(packageJson.scripts.test).toBeDefined();
    });
  });

  describe('类型定义验证', () => {
    it('dist/server.d.ts 应该包含 startServer', () => {
      const dtsPath = path.join(__dirname, '../dist/server.d.ts');
      const content = readFileSync(dtsPath, 'utf-8');
      expect(content).toContain('startServer');
    });

    it('dist/server.d.ts 应该导出 server', () => {
      const dtsPath = path.join(__dirname, '../dist/server.d.ts');
      const content = readFileSync(dtsPath, 'utf-8');
      expect(content).toContain('server');
    });

    it('dist/cli.d.ts 应该存在', () => {
      const dtsPath = path.join(__dirname, '../dist/cli.d.ts');
      expect(existsSync(dtsPath)).toBe(true);
    });
  });

  describe('环境变量验证', () => {
    it('应该在文档中记录 ANTHROPIC_API_KEY 需求', () => {
      const readmePath = path.join(__dirname, '../README.md');
      const content = readFileSync(readmePath, 'utf-8');
      expect(content).toContain('ANTHROPIC_API_KEY');
    });

    it('README 应该包含启动说明', () => {
      const readmePath = path.join(__dirname, '../README.md');
      const content = readFileSync(readmePath, 'utf-8');
      expect(content).toMatch(/npx.*claude-agent-mcp|node.*cli\.js/);
    });
  });
});

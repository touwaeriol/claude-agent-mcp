# Codex Integration Guide

快照版本 `1.1.1-snapshot` 已发布到 npm，可在 Codex IDE 中配置使用。

## 🚀 在 Codex 中配置 claude-agent-mcp

### 方法 1: 使用最新快照版本（推荐开发用途）

编辑 `$CODEX_HOME/config.toml`（通常是 `~/.codex/config.toml`）：

```toml
[mcp_servers.claude-agent-mcp]
command = "npx"
args = ["claude-agent-mcp@snapshot"]
env = { ANTHROPIC_API_KEY = "${ANTHROPIC_API_KEY}" }
```

### 方法 2: 使用稳定版本（生产环境）

```toml
[mcp_servers.claude-agent-mcp]
command = "npx"
args = ["claude-agent-mcp@latest"]
env = { ANTHROPIC_API_KEY = "${ANTHROPIC_API_KEY}" }
```

### 方法 3: 使用指定版本

```toml
[mcp_servers.claude-agent-mcp]
command = "npx"
args = ["claude-agent-mcp@1.1.1-snapshot"]
env = { ANTHROPIC_API_KEY = "${ANTHROPIC_API_KEY}" }
```

### 方法 4: 使用本地安装的版本

```toml
[mcp_servers.claude-agent-mcp]
command = "node"
args = ["/Users/erio/codes/idea/claude-agent-mcp/dist/cli.js"]
env = { ANTHROPIC_API_KEY = "${ANTHROPIC_API_KEY}" }
```

---

## 📋 完整的 config.toml 示例

```toml
# Codex Configuration
version = "0.1"

# Claude Agent MCP Server
[mcp_servers.claude-agent-mcp]
command = "npx"
args = ["claude-agent-mcp@snapshot"]

[mcp_servers.claude-agent-mcp.env]
ANTHROPIC_API_KEY = "${ANTHROPIC_API_KEY}"
```

---

## ✅ 验证配置

配置完成后，重启 Codex 并验证：

```bash
# 检查配置是否正确
cat ~/.codex/config.toml

# 查看 MCP 服务器状态
# 在 Codex 中打开 MCP 调试面板或查看日志
```

---

## 🔄 版本信息

### 可用版本

| 版本 | 说明 | 标签 |
|------|------|------|
| 1.1.1-snapshot | 最新开发版 | `snapshot` ⭐ |
| 1.1.0 | 最新稳定版 | `latest` |
| 1.0.1 | 前一版本 | - |
| 1.0.0 | 初始版本 | - |

### 更新版本

要更新到最新版本，只需修改 `args` 中的版本号或标签：

```toml
# 更新到最新快照
args = ["claude-agent-mcp@snapshot"]

# 更新到最新稳定
args = ["claude-agent-mcp@latest"]

# 指定具体版本
args = ["claude-agent-mcp@1.1.1-snapshot"]
```

---

## 🔧 环境变量配置

确保 `ANTHROPIC_API_KEY` 已正确设置：

```bash
# 方式 1: 在 shell 中设置
export ANTHROPIC_API_KEY="your-api-key-here"

# 方式 2: 在 config.toml 中设置
[mcp_servers.claude-agent-mcp.env]
ANTHROPIC_API_KEY = "your-api-key-here"

# 方式 3: 使用环境变量引用
[mcp_servers.claude-agent-mcp.env]
ANTHROPIC_API_KEY = "${ANTHROPIC_API_KEY}"
```

---

## 📝 工具使用

配置完成后，在 Codex 中可以使用以下 MCP 工具：

### ⭐ 快速查询（推荐一次性工作使用）

```
claude_direct_query      # 一键查询 - 自动创建/销毁临时会话
```

**参数:**
- `prompt`: 用户输入内容 (必需)
- `model`: `opus` | `sonnet` | `haiku` (可选)
- `permissionMode`: `default` | `acceptEdits` | `plan` | `bypassPermissions` (可选)
- `includeThinking`: `true` | `false` (可选，默认 false)
- `systemPrompt`: 自定义系统提示词 (可选)
- `cwd`: 工作目录 (可选)

**特点:**
- ✅ 无需手动创建和关闭会话
- ✅ 一步到位的查询
- ✅ 自动处理会话生命周期
- ✅ 适合一次性工作

### 会话管理（用于多轮对话）

```
claude_session_create    # 创建新会话
claude_session_close     # 关闭会话
```

**参数:**
- `model`: `opus` | `sonnet` | `haiku` (可选)
- `permissionMode`: `default` | `acceptEdits` | `plan` | `bypassPermissions` (可选)
- `cwd`: 工作目录 (可选)

### 对话交互（需配合会话使用）

```
claude_chat_query        # 发送查询
claude_chat_interrupt    # 中断查询
claude_chat_model        # 切换模型
claude_chat_mode         # 切换权限模式
```

---

## 🐛 调试

### 查看 MCP 日志

```bash
# 方式 1: 检查 Codex 日志
tail -f ~/.codex/logs/mcp.log

# 方式 2: 启用详细日志
[mcp_servers.claude-agent-mcp]
debug = true
```

### 常见问题

#### 1. "命令未找到" 错误

```bash
# 确保 npx 已安装
npm install -g npm@latest

# 或使用本地路径
command = "node"
args = ["/path/to/claude-agent-mcp/dist/cli.js"]
```

#### 2. "API 密钥无效" 错误

```bash
# 检查 ANTHROPIC_API_KEY 是否正确设置
echo $ANTHROPIC_API_KEY

# 在 config.toml 中验证
[mcp_servers.claude-agent-mcp.env]
ANTHROPIC_API_KEY = "${ANTHROPIC_API_KEY}"
```

#### 3. "连接被拒绝" 错误

```bash
# 检查 MCP 服务器是否正常启动
npx claude-agent-mcp

# 检查端口是否被占用
lsof -i :8000
```

---

## 📚 更多信息

- **NPM 包**: https://www.npmjs.com/package/claude-agent-mcp
- **GitHub**: https://github.com/touwaeriol/claude-agent-mcp
- **快照版本**: https://www.npmjs.com/package/claude-agent-mcp?activeTab=versions

---

**最后更新**: 2025-10-23
**当前版本**: 1.1.1-snapshot ⭐

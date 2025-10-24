# Claude Agent MCP サーバー

[English](./README.md) • [中文](./README.zh-CN.md) • [日本語](./README.ja.md) • [한국어](./README.ko.md)

## 概要

Claude Agent MCP は、`claude-agent-sdk-ts` ライブラリをブリッジし、Claude Code CLI やその他の AI 開発ツールにストリーミング会話機能を公開する Node.js ベースの Model Context Protocol (MCP) サーバーです。

### 主な機能

- **MCP サーバー実装**：`@modelcontextprotocol/sdk` に基づき、MCP プロトコル標準に完全に準拠
- **セッション管理**：`ClaudeAgentSDKClient` を活用した堅牢なセッション管理
- **6 つのコアツール**：
  - `claude_session_create` - 新しい Claude セッションを作成
  - `claude_session_close` - セッションをクローズしてクリーンアップ
  - `claude_chat_query` - プロンプトを送信し、ストリーミング応答を受信
  - `claude_chat_interrupt` - アクティブなクエリを中断
  - `claude_chat_model` - AI モデル間で切り替え
  - `claude_chat_mode` - 権限モードを変更
- **ストリーミングログ**：異なるメッセージタイプに対して `info`、`debug`、`error` レベルの構造化ログを提供

## クイックスタート

### インストール

```bash
npm install --save claude-agent-mcp
```

### サーバーの実行

```bash
# TypeScript をビルド（npm パッケージに事前ビルド済み、オプション）
npm run build

# サーバーを起動
npx claude-agent-mcp

# または Node で直接実行
node dist/cli.js
```

**要件**：`ANTHROPIC_API_KEY` 環境変数を設定し、Claude CLI をインストールしてください。

## 統合例

### Claude Code CLI

```bash
# 1. パッケージをインストール
npm install --save claude-agent-mcp

# 2. MCP サーバーを登録
claude mcp add claude-agent-mcp \
  --command npx \
  --args claude-agent-mcp

# 3. 確認
claude mcp list
```

### Cursor IDE

`~/.cursor/mcp.config.json` に追加：

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

### Cline (VS Code 拡張機能)

VS Code コマンドパレット経由：「Cline: Open Settings (JSON)」を選択

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

`$CODEX_HOME/config.toml` で設定：

```toml
[mcp_servers.claude-agent-mcp]
command = "npx"
args = ["claude-agent-mcp"]
```

## テスト

統合テストスイートを実行：

```bash
npm install
npm run build
npx ts-node scripts/real-integration-test.ts
```

テストカバレッジ：
- ✅ すべてのコア機能をカバーする 112 個のユニットテスト
- ✅ デプロイ準備状況を確認する 29 個の統合テスト
- ✅ MCP プロトコル準拠の完全確認

## プロジェクト構造

```
├── src/
│   ├── server.ts              # MCP サーバーコア実装（790 行）
│   └── cli.ts                 # CLI エントリーポイント
├── scripts/
│   ├── mcp-smoke.ts           # スモークテストスクリプト
│   └── real-integration-test.ts # 完全統合テスト
├── tests/
│   ├── server.test.ts         # ユニットテスト（38 個）
│   ├── mcp-tools.test.ts      # ツール層テスト（45 個）
│   ├── integration.test.ts    # 統合テスト（29 個）
│   └── TEST_GUIDE.md          # 完全なテストドキュメント
├── package.json
├── tsconfig.json
├── CLAUDE.md                  # アーキテクチャガイド
└── README.ja.md               # このファイル
```

## 開発

```bash
# 依存関係をインストール
npm install

# 開発モード（ts-node）
npm run dev

# TypeScript をビルド
npm run build

# すべてのテストを実行
npm test

# ウォッチモードでテスト
npm run test:watch

# カバレッジレポートを生成
npm run test:coverage

# ビルド成果物をクリーン
npm run clean
```

## 発行

```bash
# バージョンを更新
npm version patch  # または minor/major

# 発行用にビルド
npm run build

# npm に発行
npm publish

# ユーザーはその後、次のを使用できます：
npx claude-agent-mcp              # 自動ダウンロードして実行
npm install -g claude-agent-mcp   # グローバルインストール
```

## ツールリファレンス

### `claude_session_create`
新しい Claude セッションを作成するか、Claude CLI の `--resume` を使って既存セッションを再開します。

**パラメータ：**
- `sessionId`（オプション）：再開したい Claude CLI のセッション ID（`--resume` に対応）
- `cwd`（オプション）：作業ディレクトリ
- `model`（オプション）：モデル名（`opus` | `sonnet` | `haiku`）
- `permissionMode`（オプション）：権限モード（default|acceptEdits|plan|bypassPermissions）
- `systemPrompt`（オプション）：カスタムシステムプロンプト

**戻り値：** `{ sessionId, model, cwd, permissionMode, systemPrompt, active, createdAt, resumed, resumedFrom }`

### `claude_chat_query`
Claude にプロンプトを送信して応答を受け取ります。

**パラメータ：**
- `sessionId`（必須）：セッション ID
- `prompt`（必須）：ユーザープロンプト
- `closeAfter`（オプション）：クエリ後にセッションを自動クローズ
- `includeThinking`（オプション）：Claude の思考プロセスを含める

**戻り値：** `{ finalText, thinking[], toolInvocations[], metadata }`

### `claude_chat_model`
セッションのモデルを切り替えます。

**パラメータ：**
- `sessionId`（必須）：セッション ID
- `model`（必須）：ターゲットモデル

**戻り値：** `{ requestedModel, resolvedModel }`

### `claude_chat_mode`
権限モードを変更します。

**パラメータ：**
- `sessionId`（必須）：セッション ID
- `permissionMode`（必須）：権限モードのいずれか：default|acceptEdits|plan|bypassPermissions

**戻り値：** `{ permissionMode }`

### `claude_chat_interrupt`
現在のクエリを中断します。

**パラメータ：**
- `sessionId`（必須）：セッション ID

**戻り値：** `{ interrupted: true }`

### `claude_session_close`
セッションをクローズしてクリーンアップします。

**パラメータ：**
- `sessionId`（必須）：セッション ID

**戻り値：** `{ activeSessions: number }`

## ドキュメント

- **[CLAUDE.md](./CLAUDE.md)** - アーキテクチャと設計上の決定
- **[tests/TEST_GUIDE.md](./tests/TEST_GUIDE.md)** - 完全なテストガイド
- **[AGENTS.md](./AGENTS.md)** - AI コラボレーション規約

## ライセンス

MIT

## 貢献

貢献を歓迎します！以下を確認してください：
- すべてのテストが成功する：`npm test`
- コードにビルドエラーがない：`npm run build`
- ドキュメントが更新されている

---

**最終更新**：2025 年 10 月 23 日

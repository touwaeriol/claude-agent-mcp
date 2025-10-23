# Claude Agent MCP 서버

[English](./README.md) • [中文](./README.zh-CN.md) • [日本語](./README.ja.md) • [한국어](./README.ko.md)

## 개요

Claude Agent MCP는 `claude-agent-sdk-ts` 라이브러리를 브릿지하여 Claude Code CLI 및 기타 AI 개발 도구에 스트리밍 대화 기능을 제공하는 Node.js 기반 Model Context Protocol (MCP) 서버입니다.

### 주요 기능

- **MCP 서버 구현**: `@modelcontextprotocol/sdk`를 기반으로 MCP 프로토콜 표준을 완전히 준수
- **세션 관리**: `ClaudeAgentSDKClient`를 활용한 강력한 세션 관리
- **6 가지 핵심 도구**:
  - `claude_session_create` - 새 Claude 세션 생성
  - `claude_session_close` - 세션 종료 및 정리
  - `claude_chat_query` - 프롬프트 전송 및 스트리밍 응답 수신
  - `claude_chat_interrupt` - 활성 쿼리 중단
  - `claude_chat_model` - AI 모델 간 전환
  - `claude_chat_mode` - 권한 모드 변경
- **스트리밍 로깅**: 다양한 메시지 유형에 대해 `info`, `debug`, `error` 레벨의 구조화된 로깅 제공

## 빠른 시작

### 설치

```bash
npm install --save claude-agent-mcp
```

### 서버 실행

```bash
# TypeScript 빌드 (npm 패키지에 사전 빌드됨, 선택사항)
npm run build

# 서버 시작
npx claude-agent-mcp

# 또는 Node로 직접 실행
node dist/cli.js
```

**요구사항**: `ANTHROPIC_API_KEY` 환경 변수 설정 및 Claude CLI 설치 필수.

## 통합 예시

### Claude Code CLI

```bash
# 1. 패키지 설치
npm install --save claude-agent-mcp

# 2. MCP 서버 등록
claude mcp add claude-agent-mcp \
  --command npx \
  --args claude-agent-mcp

# 3. 확인
claude mcp list
```

### Cursor IDE

`~/.cursor/mcp.config.json`에 추가:

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

### Cline (VS Code 확장)

VS Code 명령 팔레트에서 "Cline: Open Settings (JSON)" 선택:

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

`$CODEX_HOME/config.toml`에서 구성:

```toml
[mcp_servers.claude-agent-mcp]
command = "npx"
args = ["claude-agent-mcp"]
```

## 테스트

통합 테스트 스위트 실행:

```bash
npm install
npm run build
npx ts-node scripts/real-integration-test.ts
```

테스트 범위:
- ✅ 모든 핵심 기능을 다루는 112개의 단위 테스트
- ✅ 배포 준비 상태를 확인하는 29개의 통합 테스트
- ✅ MCP 프로토콜 준수에 대한 완전한 검증

## 프로젝트 구조

```
├── src/
│   ├── server.ts              # MCP 서버 핵심 구현 (790줄)
│   └── cli.ts                 # CLI 진입점
├── scripts/
│   ├── mcp-smoke.ts           # 스모크 테스트 스크립트
│   └── real-integration-test.ts # 완전 통합 테스트
├── tests/
│   ├── server.test.ts         # 단위 테스트 (38개)
│   ├── mcp-tools.test.ts      # 도구 계층 테스트 (45개)
│   ├── integration.test.ts    # 통합 테스트 (29개)
│   └── TEST_GUIDE.md          # 완전한 테스트 문서
├── package.json
├── tsconfig.json
├── CLAUDE.md                  # 아키텍처 가이드
└── README.ko.md               # 이 파일
```

## 개발

```bash
# 종속성 설치
npm install

# 개발 모드 (ts-node)
npm run dev

# TypeScript 빌드
npm run build

# 모든 테스트 실행
npm test

# 감시 모드로 테스트
npm run test:watch

# 커버리지 보고서 생성
npm run test:coverage

# 빌드 아티팩트 정리
npm run clean
```

## 게시

```bash
# 버전 업데이트
npm version patch  # 또는 minor/major

# 게시 버전 빌드
npm run build

# npm에 게시
npm publish

# 사용자는 다음을 사용할 수 있습니다:
npx claude-agent-mcp              # 자동 다운로드 및 실행
npm install -g claude-agent-mcp   # 전역 설치
```

## 도구 참조

### `claude_session_create`
새 Claude 세션을 생성합니다.

**파라미터:**
- `cwd` (선택사항): 작업 디렉토리
- `model` (선택사항): 모델 이름
- `permissionMode` (선택사항): 권한 모드 (default|acceptEdits|plan|bypassPermissions)
- `systemPrompt` (선택사항): 사용자 지정 시스템 프롬프트

**반환값:** `{ sessionId, model, cwd, active, createdAt }`

### `claude_chat_query`
Claude에 프롬프트를 보내고 응답을 받습니다.

**파라미터:**
- `sessionId` (필수): 세션 ID
- `prompt` (필수): 사용자 프롬프트
- `closeAfter` (선택사항): 쿼리 후 세션 자동 종료
- `includeThinking` (선택사항): Claude의 사고 과정 포함

**반환값:** `{ finalText, thinking[], toolInvocations[], metadata }`

### `claude_chat_model`
세션의 모델을 전환합니다.

**파라미터:**
- `sessionId` (필수): 세션 ID
- `model` (필수): 대상 모델

**반환값:** `{ requestedModel, resolvedModel }`

### `claude_chat_mode`
권한 모드를 변경합니다.

**파라미터:**
- `sessionId` (필수): 세션 ID
- `permissionMode` (필수): 권한 모드 중 하나: default|acceptEdits|plan|bypassPermissions

**반환값:** `{ permissionMode }`

### `claude_chat_interrupt`
현재 쿼리를 중단합니다.

**파라미터:**
- `sessionId` (필수): 세션 ID

**반환값:** `{ interrupted: true }`

### `claude_session_close`
세션을 종료하고 정리합니다.

**파라미터:**
- `sessionId` (필수): 세션 ID

**반환값:** `{ activeSessions: number }`

## 문서

- **[CLAUDE.md](./CLAUDE.md)** - 아키텍처 및 설계 결정사항
- **[tests/TEST_GUIDE.md](./tests/TEST_GUIDE.md)** - 완전한 테스트 가이드
- **[AGENTS.md](./AGENTS.md)** - AI 협업 규칙

## 라이선스

MIT

## 기여

기여를 환영합니다! 다음을 확인하세요:
- 모든 테스트 통과: `npm test`
- 코드 빌드 오류 없음: `npm run build`
- 문서 업데이트 완료

---

**마지막 업데이트**: 2025년 10월 23일

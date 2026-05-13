# Promptshot — Design Spec

- **Date**: 2026-05-13
- **Author**: sunio (with brainstorming assistance)
- **Status**: Draft v2 (CLI 제거, macOS chrome, cross-platform, marketplace 배포 반영)

## 1. Overview

Promptshot은 VS Code의 보조 사이드바에 들어 있는 AI 어시스턴트 — **Codex와 Claude Code (둘 다 동등 1순위)** — 와의 대화 중 **마지막 user→assistant 쌍 하나**를 슬랙/이메일에 공유할 만큼 예쁜 이미지로 캡쳐하는 VS Code 확장이다. Carbon.now.sh가 코드를 예쁜 이미지로 만들어주듯, Promptshot은 AI 대화를 예쁜 이미지로 만들어준다.

### 1.1 Motivation

- VS Code 확장은 다른 확장의 Webview 내부에 접근할 수 없어, OS 레벨 스크린샷이 아니면 **사이드바 AI 채팅을 직접 캡쳐할 방법이 없음**.
- 기존 도구(SpecStory, Copilot Chat Exporter 등)는 텍스트/마크다운 익스포트 중심이고, **공유 친화적인 이미지 출력**은 공백 영역.
- Codex와 Claude Code는 모두 세션을 JSONL로 로컬에 저장하므로, 이를 파싱해 **자체 렌더링**하는 방식이 실제 사이드바 캡쳐보다 결과물이 깔끔하고 안정적.

### 1.2 Goals

- ✅ **VS Code 확장 단독 설치로 모든 기능 동작** (CLI 없음)
- ✅ **Codex와 Claude Code 둘 다 동등 1순위 지원**
- ✅ 마지막 user→assistant 한 쌍을 한 번의 키 입력으로 캡쳐
- ✅ Slack/이메일에 즉시 붙여넣을 수 있는 PNG (이미지 클립보드)
- ✅ 마크다운 클립보드 모드 (위키/GitHub용)
- ✅ macOS 작업창 스타일의 심플한 시각 폴리시
- ✅ **Cross-platform**: Windows / macOS / Linux 모두 동일 코드로 동작 (네이티브 모듈/OS별 분기 없음)
- ✅ VS Code Marketplace 정식 등록

### 1.3 Non-Goals

- ❌ 사이드바 Webview를 픽셀 단위로 충실히 캡쳐 (재렌더링 방식 선택)
- ❌ 전체 대화 세션 아카이브 (SpecStory 등 기존 도구 활용 권장)
- ❌ 임의 범위 선택 UI (v2 후보)
- ❌ Cursor / GitHub Copilot Chat 지원 (v2 후보)
- ❌ 터미널 출력 캡쳐 (v2 후보)
- ❌ CLI / 글로벌 핫키 / Marketplace 외 배포 채널

### 1.4 User Stories

1. *코드 리뷰 중 Claude Code가 좋은 설명을 줬다 → `Ctrl+Alt+P` → 슬랙 채널에 붙여넣기 → 팀원들이 한눈에 봄.*
2. *Codex가 디자인 패턴을 정리해줬다 → Command Palette → `Promptshot: Capture as Markdown` → Confluence 위키에 마크다운으로 붙여넣기.*
3. *세션 여러 개를 동시에 진행 중이라 어느 게 잡혔는지 헷갈림 → 캡쳐 후 chrome에 표시된 `Codex · 2분 전` / `Claude Code · 30초 전` 라벨로 확인.*

## 2. System Architecture

```
promptshot/  (pnpm 모노레포)
├── packages/
│   ├── core/         # 비-UI 로직 (VS Code API 의존 없음, 순수 TS)
│   │   ├── sources/      # Codex/Claude JSONL 파싱 → Exchange
│   │   ├── selector/     # 최신 exchange 자동 선택
│   │   ├── theme/        # 프리셋 (mac-light / mac-dark)
│   │   ├── render/       # JSX 트리 → Satori → SVG → PNG
│   │   ├── redact/       # API 키/토큰 자동 마스킹
│   │   └── output/       # PNG 파일 저장 (cross-platform fs)
│   │
│   └── vscode-ext/   # VS Code 확장 (.vsix → Marketplace)
│       ├── commands     # "Promptshot: Capture Last Exchange" 외
│       ├── webview/     # 이미지 클립보드용 hidden webview (cross-platform)
│       └── keybindings  # Ctrl+Alt+P (Mac: Cmd+Alt+P, 사용자 변경 가능)
│
├── docs/
│   ├── superpowers/specs/    # 본 디자인 스펙
│   ├── DECISIONS.md          # 프로젝트 결정 기록 (ADR 스타일, 누적)
│   └── samples/              # 샘플 출력 카탈로그 (PNG 예시)
└── package.json (workspace root)
```

**원칙**:
- `core`는 VS Code API에 의존하지 않는다 (순수 TS + Node 표준 라이브러리).
- core 내부는 단방향 의존: `sources → selector → render → output`.
- 각 source는 동일한 `Exchange` 타입으로 정규화 후 selector에 전달.
- **모든 의존성은 pure JS 또는 WebAssembly** (네이티브 컴파일 모듈 금지) → cross-platform 보장.

**외부 의존성** (전부 cross-platform):
- `satori` (pure JS, JSX → SVG)
- `@resvg/resvg-js` (WebAssembly, SVG → PNG)
- `shiki` (pure JS, 코드 하이라이트)
- `remark`, `remark-parse`, `remark-gfm` (pure JS, 마크다운 파싱)
- `vitest` (테스트)

**Cross-platform 검증 포인트** (구현 전 PoC 필수):
1. `@resvg/resvg-js` WebAssembly 빌드가 Windows/macOS/Linux 모두에서 npm install로 즉시 동작하는지
2. 이미지 클립보드를 Webview의 `navigator.clipboard.write(new ClipboardItem(...))` API로 OS 무관하게 수행 가능한지 (Section 3.6 참조)
3. 폰트 번들이 모든 OS에서 동일하게 렌더되는지 (한글/이모지 포함)

## 3. Components

### 3.1 `core/sources/`

각 AI 어시스턴트의 JSONL 포맷을 공통 타입으로 정규화한다. **Codex와 Claude Code는 동등하게 1순위로 지원**한다.

```typescript
type Exchange = {
  source: 'codex' | 'claude-code'
  sourceLabel: string                             // 'Codex' | 'Claude Code'
  sessionId: string
  sessionPath: string
  timestamp: Date
  user: { content: string }                       // markdown
  assistant: { content: string; model?: string }  // markdown
}

interface ChatSource {
  readonly id: 'codex' | 'claude-code'
  readonly label: string                          // 헤더 표시용 'Codex' | 'Claude Code'
  discoverSessions(): Promise<SessionFile[]>      // mtime 내림차순
  parseLastExchange(file: SessionFile): Promise<Exchange | null>
}
```

두 source 모두 VS Code 보조 사이드바에 자체 webview chat을 띄우는 공식 확장을 가진다 (Codex / Claude Code for VS Code). 두 확장 모두 다음과 같이 로컬에 세션 로그를 JSONL로 저장한다:

- **CodexSource**: `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl`
  - JSONL을 한 줄씩 스트리밍 파싱
  - role=user/assistant 이벤트 추출
- **ClaudeCodeSource**: `~/.claude/projects/<encoded-path>/<session-uuid>.jsonl`
  - role=user/assistant 추출, subagent 파일은 무시 (메인 채팅만)
- 둘 다 **subagent / tool_use / tool_result / system 메시지는 기본 필터링** (사이드바 사용자 시야에 보이는 user/assistant 말풍선만 캡쳐)

### 3.2 `core/selector/`

```typescript
async function selectLatestExchange(opts?: {
  source?: 'codex' | 'claude-code' | 'auto'   // 기본 'auto'
  sessionId?: string                          // 명시 지정
  workspaceHint?: string                      // VS Code 활성 워크스페이스 경로
}): Promise<Exchange>
```

- `auto`: 두 소스의 최근 JSONL의 mtime 비교 → 더 최근 것 채택 → 마지막 user→assistant 쌍 추출
- `workspaceHint` 전달 시 Claude Code의 `~/.claude/projects/<encoded>/` 매칭을 1순위 힌트로 사용
- 명시 지정(`source: 'codex'`)은 폴백 없이 그대로 존중

### 3.3 `core/theme/` — macOS 작업창 스타일

심플함을 핵심으로 한다. macOS Finder/window의 미학을 따른다:

- **Chrome**: 좌상단 traffic lights (● ● ●, 빨강/노랑/초록), 가운데에 작은 라벨 (`Codex · 2분 전`)
- **배경**: 단색 (그라데이션 없음). `mac-light`는 살짝 따뜻한 회색(#f5f5f7), `mac-dark`는 macOS Dark 회색(#1e1e1e)
- **창 바디**: 흰색(라이트) / 진회색(다크) 배경 + 부드러운 드롭 섀도우 + 라운디드 코너(12px)
- **타이포그래피**: SF Pro 느낌의 sans-serif (Pretendard로 한글 커버)
- **코드 블록**: shiki `github-light` / `github-dark`

```typescript
type Theme = {
  name: 'mac-light' | 'mac-dark'
  outerBackground: string         // 캔버스 배경 (단색)
  outerPadding: number            // 캔버스 패딩
  windowBackground: string        // 창 내부 배경
  cornerRadius: number            // 12
  shadow: ShadowSpec              // 부드러운 한 겹
  chrome: {
    trafficLights: boolean        // true
    label: 'source-and-time'      // 'Codex · 2분 전'
  }
  codeTheme: 'github-light' | 'github-dark'
  font: { sans: string; mono: string }
}
```

v1 프리셋 2개:
- **mac-light** (기본): `#f5f5f7` 배경, 흰 창, github-light 코드
- **mac-dark**: `#1e1e1e` 배경, `#2c2c2e` 창, github-dark 코드

폰트는 **Pretendard**(한글 + 라틴) + **JetBrains Mono**(코드)를 `packages/core/assets/fonts/` 에 번들 (npm install 외 추가 다운로드 없음).

### 3.4 `core/render/`

```typescript
async function renderExchange(ex: Exchange, theme: Theme): Promise<Buffer>
```

내부 단계:
1. `remark` + `remark-gfm` → markdown AST
2. AST → Satori 호환 JSX 트리 (화이트리스트 컴포넌트)
   - 코드 블록: Shiki로 토큰별 색칠된 `<span>` 트리
   - 표/리스트/인라인 코드/링크/볼드/이탤릭 처리
3. `satori(JSX, { width, fonts })` → SVG
4. `resvg.render(SVG)` → PNG `Buffer`

기본 너비 **720px** (슬랙 미리보기 적정), 높이 가변. 설정에서 변경 가능.

### 3.5 `core/redact/`

세션 JSONL은 민감 정보를 포함할 수 있으므로 자동 마스킹.

- 패턴: `sk-...`, `gh[ps]_...`, JWT(`eyJ...` + `.` 구분), AWS access key, Google API key 등
- 마스킹 발생 시 VS Code 알림에 "Redacted N tokens" 표시
- `promptshot.includeTools`, `promptshot.includeSystem` 설정은 명시적으로 켜야 동작 (기본 off)

### 3.6 `core/output/` & 이미지 클립보드 (Cross-platform)

**파일 저장** (cross-platform fs):
- 기본 경로: `<os.homedir()>/Pictures/Promptshot/YYYY-MM-DD_HH-mm-ss.png`
- macOS/Linux도 `~/Pictures/`가 표준
- `promptshot.outputDir` 설정으로 변경 가능

**이미지 클립보드** — OS-agnostic 전략:
> VS Code Extension API의 `vscode.env.clipboard`는 텍스트 전용. 이미지 클립보드는 OS별로 분기하지 않고 **hidden Webview의 브라우저 Clipboard API**로 통일한다.

```
1. 확장이 이미지 PNG Buffer 생성
2. 보이지 않는 Webview 패널을 띄움 (1x1 픽셀, position=offscreen)
3. Webview에 base64 인코딩된 PNG를 postMessage
4. Webview 내부 JS:
   const blob = await fetch(`data:image/png;base64,${b64}`).then(r => r.blob())
   await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
   vscode.postMessage({ ok: true })
5. 확장이 ack 받으면 Webview 닫음
```

이 방식은 Chromium 기반이라 Windows/macOS/Linux 모두 동일 동작. **단, 첫 호출 시 권한 프롬프트가 뜰 수 있는지 PoC 단계에서 검증 필요**.

**마크다운 모드**:
- `vscode.env.clipboard.writeText()` (텍스트는 cross-platform 보장)
- v1은 클립보드만 지원. 파일 저장은 v2 후보 (필요 시 사용자가 직접 붙여넣어 저장)

### 3.7 `vscode-ext/`

명령 (Command Palette):
- `Promptshot: Capture Last Exchange` (기본 `Ctrl+Alt+P` / `Cmd+Alt+P`) — 이미지 + 클립보드
- `Promptshot: Capture as Markdown` — 마크다운 + 클립보드
- `Promptshot: Pick Session…` — 최근 세션 목록을 Quick Pick으로 보여주고 선택
- `Promptshot: Choose Theme…` — mac-light / mac-dark 토글
- `Promptshot: Open Last Capture` — OS 파일 매니저로 열기 (`vscode.env.openExternal`)

설정 (`contributes.configuration`):
- `promptshot.theme` ('mac-light' | 'mac-dark', 기본 'mac-light')
- `promptshot.source` ('auto' | 'codex' | 'claude-code', 기본 'auto')
- `promptshot.outputDir` (string, 기본 `~/Pictures/Promptshot`)
- `promptshot.width` (number, 기본 720)
- `promptshot.maxHeight` (number, 기본 4000, 초과 시 하단 페이드 처리)
- `promptshot.includeTools` / `promptshot.includeSystem` (boolean, 기본 false)

활성 워크스페이스 경로를 `workspaceHint`로 core selector에 전달.

**Marketplace 메타데이터** (`package.json`):
- `publisher`: 결정 필요 (Open Questions 1번)
- `displayName`: "Promptshot — Beautiful AI Chat Captures"
- `categories`: ["Visualization", "Other"]
- `keywords`: ["ai", "chat", "screenshot", "claude", "codex", "share"]
- `icon`: 128x128 PNG (Carbon 스타일의 brand mark)
- `repository`: GitHub URL
- `engines.vscode`: `^1.85.0` (Webview clipboard API 안정 버전)

## 4. Data Flow

```
[VS Code: Ctrl+Alt+P 또는 Command Palette]
    │
    ▼
1. vscode-ext가 활성 workspace 경로 수집
    ▼
2. core.selector.selectLatestExchange({ source: 'auto', workspaceHint })
    ├─ CodexSource.discoverSessions()       // mtime 정렬
    └─ ClaudeCodeSource.discoverSessions()  // mtime 정렬
    → 가장 최신 SessionFile 1개 결정
    ▼
3. <Source>.parseLastExchange(file)
    JSONL 스트림 → user/assistant 필터
    → 마지막 user + 그 다음 assistant 쌍
    → Exchange 객체
    ▼
4. 모드 분기:
    [Markdown 모드] → vscode.env.clipboard.writeText(md) → 끝
    [Image 모드]  ↓
    ▼
5. redact.scan(exchange) → 마스킹 (필요 시)
    ▼
6. render.renderExchange(exchange, theme)
    a. markdown → AST
    b. AST → Satori JSX 트리 (Shiki 적용)
    c. Satori(JSX) → SVG
    d. resvg(SVG) → PNG Buffer
    ▼
7. output (병렬)
    ├─ saveToFile(buffer, path)                     // Node fs, cross-platform
    └─ Hidden Webview에 base64 전달 → navigator.clipboard.write()
    ▼
[VS Code Notification: "Captured (450ms) · Open file?"]
```

### 4.1 이미지 레이아웃 (macOS 작업창 스타일)

```
┌────────── outer canvas (#f5f5f7, padding 24px) ──────────┐
│                                                          │
│   ╭──────────────────────────────────────────────╮      │
│   │ ● ● ●        Codex · 2분 전                  │      │  ← chrome
│   ├──────────────────────────────────────────────┤      │
│   │                                              │      │
│   │  👤  사용자 메시지                            │      │
│   │     (markdown 렌더링: 인라인 코드, 볼드…)    │      │
│   │                                              │      │
│   │  ─────────                                   │      │
│   │                                              │      │
│   │  🤖  AI 응답                                  │      │
│   │     (Shiki 코드, 표, 리스트)                 │      │
│   │                                              │      │
│   ╰──────────────────────────────────────────────╯      │
│        (라운디드 12px + 부드러운 단일 섀도우)             │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

## 5. Error Handling & Edge Cases

### 5.1 환경/입력

| 상황 | 처리 |
|---|---|
| 두 소스 디렉토리 모두 없음 | 알림: "No AI sessions found. Try using Codex or Claude Code first." |
| JSONL 0개 | 알림: "0 sessions found." |
| `source: codex` 설정인데 비어있음 | 폴백 안 함, 명시적 에러 |
| 권한 부족 | 알림: 경로 표시 + OS 권한 안내 링크 |

### 5.2 파싱

| 상황 | 처리 |
|---|---|
| 마지막 줄 truncated | 무시하고 그 전까지 |
| user 메시지만 있고 assistant 없음 | 알림: "Last exchange has no assistant response yet." |
| user/assistant 외 role만 존재 | 빈 결과 + 위 메시지 |
| schema 변경으로 파싱 실패 | schema version 체크 → 에러 알림 + Output Channel에 raw line 일부 |

### 5.3 렌더

| 상황 | 처리 |
|---|---|
| 한글 폰트 누락 | 번들된 Pretendard 사용 (시스템 폰트 의존 없음). 누락 글리프는 Satori fallback |
| Satori 미지원 CSS | 사전 화이트리스트 컴포넌트만 사용 |
| 매우 긴 메시지 (예: 100KB) | 기본은 전체 렌더, `promptshot.maxHeight` 초과시 하단 페이드 + "(truncated, N more lines)" |
| 이미지 첨부 | v1: `[image attachment]` placeholder, v2 인라인 임베드 |

### 5.4 출력

| 상황 | 처리 |
|---|---|
| Webview 클립보드 실패 | 파일 저장은 성공시키고 알림에 경로 + "Reveal in File Explorer" 버튼 |
| 클립보드 권한 거부 (브라우저 정책) | 알림: "VS Code 클립보드 권한 필요. 한 번 허용해주세요." 안내 |
| 파일 저장 실패 | 클립보드라도 시도. 둘 다 실패시 에러 알림 |
| 파일명 충돌 | `_2`, `_3` suffix |

### 5.5 보안/프라이버시

- 기본은 사용자 시야 메시지(user/assistant)만 추출
- `promptshot.includeSystem`, `promptshot.includeTools`는 명시적 opt-in
- API 키/토큰 패턴 자동 마스킹 + 알림
- 마스킹 규칙은 `core/redact/` 모듈로 분리 (단위 테스트 용이)

## 6. Testing Strategy

### 6.1 단위 테스트 (Vitest, 80%+ 커버리지)

| 모듈 | 대상 | 픽스처 |
|---|---|---|
| `core/sources/codex` | discoverSessions mtime 정렬, parseLastExchange 다양 케이스 | `fixtures/codex/*.jsonl` |
| `core/sources/claude-code` | 동일 + subagent 파일 무시 | `fixtures/claude-code/*.jsonl` |
| `core/selector` | auto 모드, source/sessionId 강제, 빈 결과 | mock fs |
| `core/render` | 마크다운 → JSX 매핑 (코드/표/리스트/인라인) | snapshot test (SVG 문자열) |
| `core/redact` | API 키/JWT/GitHub 토큰 마스킹 | 합성 입력 |
| `core/output` | 파일명 충돌 suffix, fs 권한 에러 | tmp dir |

### 6.2 통합 테스트

- 실제 fixtures JSONL → `render` + `output` 전체 파이프라인 → PNG 산출물
- PNG 메타 검증 (width/height/format)
- SVG snapshot 비교 (텍스트 레벨이라 cross-platform 안정)
- 마크다운 모드: 문자열 snapshot

### 6.3 VS Code 확장 테스트

- `@vscode/test-electron` 으로 실제 VS Code 인스턴스
- 명령 실행 → mock workspace + fixture 동작 검증
- Webview 클립보드는 자동화 어려움 → **수동 체크리스트**로 PR 시 확인 (Windows/macOS/Linux 각각)

### 6.4 샘플 출력 카탈로그 (`docs/samples/`)

> 시각적 회귀 자동화는 빼고, **사람 눈으로 보는 카탈로그**만 유지한다.

- 4가지 대표 fixture(짧은/긴/코드포함/표포함) × 2 테마(mac-light/mac-dark) = 8장 PNG
- `docs/samples/<theme>-<fixture>.png`
- 변경 PR마다 카탈로그 재생성 후 PR 본문에 첨부 → 사람이 보고 OK 판단
- 정확한 픽셀 매칭은 폰트 렌더링 차이로 OS마다 다를 수 있어 자동화 부적합

### 6.5 Cross-platform CI

GitHub Actions 매트릭스:
- OS: `ubuntu-latest`, `macos-latest`, `windows-latest`
- Node: 20, 22
- 단계: `pnpm install` → `pnpm test` → `pnpm package` (.vsix 산출)
- **3 OS 모두에서 단위/통합 테스트가 통과해야 함**
- Webview 클립보드는 CI에서 검증 어려움 → 별도 수동 체크리스트

### 6.6 Marketplace 발행 전 체크리스트

- [ ] icon.png 128x128 (light/dark 모두에서 잘 보임)
- [ ] README.md (스크린샷 3장 이상 + 사용법 GIF)
- [ ] LICENSE
- [ ] CHANGELOG.md
- [ ] 3 OS 수동 동작 확인 (Capture / Markdown / Clipboard)
- [ ] 한글 입력 fixture로 렌더 확인
- [ ] 권한 프롬프트 UX 확인

## 7. Open Questions

향후 결정 필요:

1. **Publisher ID**: VS Code Marketplace에 등록할 publisher 이름 (사용자 결정 필요, 이미 보유 publisher 있는지 확인)
2. **로고/아이콘 디자인**: Carbon 스타일 brand mark 디자인 누가/어떻게 (외주? Figma 자체 제작?)
3. **Codex JSONL 정확한 스키마**: 구현 단계에서 실제 fixture로 검증 필요 (이벤트 타입명, role 필드 위치 등)
4. **Webview 클립보드 권한 프롬프트 UX**: 실제 PoC로 검증 필요. 사용자 첫 사용 시 친절한 안내 다이얼로그 띄울지

## 8. Out of v1 Scope (Future)

- Cursor 채팅 지원
- GitHub Copilot Chat 지원
- 터미널 Shell Integration 캡쳐
- 임의 범위 선택 (메시지 N개)
- 전체 세션 길게 이미지화
- 웹 공유 (Carbon처럼 URL 생성)
- 추가 테마 (라이트/다크 외)

## 9. Decision Log (스펙 작성 중 결정사항)

> 본 spec 작성 과정에서 확정된 결정들. 향후 발생하는 결정은 `docs/DECISIONS.md`에 누적 기록한다.

| # | 결정 | 대안 | 이유 |
|---|---|---|---|
| 1 | 재렌더링 방식 | OS 스크린샷 | 더 깔끔, DPI/스크롤 이슈 없음, cross-platform 보장 |
| 2 | Satori 렌더러 | Puppeteer | 가볍고 빠름, Chrome 의존 없음, WebAssembly 기반 cross-platform |
| 3 | 모노레포 (core + vscode-ext) | 단일 패키지 | core 재사용 + 의존성 누수 방지 |
| 4 | 마지막 1쌍 캡쳐 | 전체 세션 / viewport | 슬랙 공유에 적합한 단위 |
| 5 | 이미지 우선, 마크다운 옵션 | 마크다운 우선 | 슬랙/이메일 공유 유즈케이스 |
| 6 | 폰트 번들 | 첫 실행 다운로드 | 예측 가능한 UX, 오프라인 동작, 패키지 ~1MB 증가 허용 |
| 7 | **CLI 제거, VS Code 확장 단독** | CLI + 확장 둘 다 | 사용자 결정. 단순화, marketplace 단일 진입점 |
| 8 | **macOS 작업창 스타일 테마** | Carbon 그라데이션 / 다양한 프리셋 | 사용자 결정. 심플함이 핵심 |
| 9 | **Cross-platform 우선** | Windows 우선 | 사용자 결정. 네이티브 모듈 금지, Webview 클립보드로 통일 |
| 10 | **Marketplace 정식 등록 (v1부터)** | sideload .vsix v1 | 사용자 결정. 정식 배포 채널로 가기 |
| 11 | **골든 이미지 자동 테스트 제거** | 12장 골든 PNG diff | 사용자 결정. 폰트 렌더링 차이로 fragile. 샘플 카탈로그로 대체 |
| 12 | **Codex / Claude Code 동등 지원** | Codex 우선 | 사용자 결정. 둘 다 사이드바 webview chat 제공, 동등 1순위 |

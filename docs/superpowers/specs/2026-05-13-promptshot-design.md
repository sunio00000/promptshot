# Promptshot — Design Spec

- **Date**: 2026-05-13
- **Author**: sunio (with brainstorming assistance)
- **Status**: Draft (pending user review)

## 1. Overview

Promptshot은 VS Code의 보조 사이드바에 있는 AI 어시스턴트(Codex, Claude Code)와의 대화 중 **마지막 user→assistant 쌍 하나**를 슬랙/이메일에 공유할 만큼 예쁜 이미지로 캡쳐하는 도구다. Carbon.now.sh가 코드를 예쁜 이미지로 만들어주듯, Promptshot은 AI 대화를 예쁜 이미지로 만들어준다.

### 1.1 Motivation

- VS Code 확장은 다른 확장의 Webview 내부에 접근할 수 없어, OS 레벨 스크린샷이 아니면 **사이드바 AI 채팅을 직접 캡쳐할 방법이 없음**.
- 기존 도구(SpecStory, Copilot Chat Exporter 등)는 텍스트/마크다운 익스포트 중심이고, **공유 친화적인 이미지 출력**은 공백 영역.
- Codex와 Claude Code는 모두 세션을 JSONL로 로컬에 저장하므로, 이를 파싱해 **자체 렌더링**하는 방식이 실제 사이드바 캡쳐보다 결과물이 깔끔하고 안정적.

### 1.2 Goals

- ✅ 마지막 user→assistant 한 쌍을 한 번의 키 입력으로 캡쳐
- ✅ Slack/이메일에 즉시 붙여넣을 수 있는 PNG (이미지 클립보드)
- ✅ 마크다운 클립보드 모드 (위키/GitHub용)
- ✅ Codex + Claude Code 자동 감지
- ✅ Carbon-스타일의 시각적 폴리시 (배경, 패딩, 라운디드, 섀도우, 코드 하이라이트)
- ✅ CLI + VS Code 확장 둘 다 지원

### 1.3 Non-Goals

- ❌ 사이드바 Webview를 픽셀 단위로 충실히 캡쳐 (재렌더링 방식 선택)
- ❌ 전체 대화 세션 아카이브 (SpecStory 등 기존 도구 활용 권장)
- ❌ 임의 범위 선택 UI (v2 후보)
- ❌ Cursor / Copilot Chat 지원 (v1 범위 외)
- ❌ 터미널 출력 캡쳐 (별도 도구 후보, v1 범위 외)
- ❌ macOS / Linux (v1은 Windows 우선, 핵심 로직은 크로스 플랫폼이지만 클립보드/폰트만 Windows 검증)

### 1.4 User Stories

1. *코드 리뷰 중 Claude가 좋은 설명을 줬다 → `Ctrl+Alt+P` → 슬랙 채널에 붙여넣기 → 팀원들이 한눈에 봄.*
2. *Codex가 디자인 패턴을 정리해줬다 → `promptshot --format md` → Confluence 위키에 마크다운으로 붙여넣기.*
3. *세션 여러 개를 동시에 진행 중이라 어느 게 잡혔는지 헷갈림 → 캡쳐 후 chrome에 표시된 `Codex · 2분 전` 라벨로 확인.*

## 2. System Architecture

```
promptshot/  (pnpm 모노레포)
├── packages/
│   ├── core/         # 비-UI 로직 (재사용 핵심, VS Code/CLI 의존 없음)
│   │   ├── sources/      # Codex/Claude JSONL 파싱 → Exchange
│   │   ├── selector/     # 최신 exchange 자동 선택
│   │   ├── theme/        # 프리셋 (carbon-dark / paper-light / velvet)
│   │   ├── render/       # JSX 트리 → Satori → SVG → PNG
│   │   ├── redact/       # API 키/토큰 자동 마스킹
│   │   └── output/       # PNG 파일 저장 + 클립보드
│   │
│   ├── cli/          # `promptshot` 실행 파일
│   │
│   └── vscode-ext/   # VS Code 확장 (.vsix)
│       ├── commands     # "Promptshot: Capture Last Exchange" 외
│       └── keybindings  # Ctrl+Alt+P (사용자 변경 가능)
│
├── docs/
└── package.json (workspace root)
```

**원칙**:
- `core`는 VS Code/CLI 어디에도 의존하지 않는다 (테스트 용이).
- core 내부는 단방향 의존: `sources → selector → render → output`.
- 각 source는 동일한 `Exchange` 타입으로 정규화 후 selector에 전달.

**외부 의존성**:
- `satori`, `@resvg/resvg-js` (렌더링)
- `shiki` (코드 하이라이트)
- `remark`, `remark-parse`, `remark-gfm` (마크다운 파싱)
- `clipboardy` + Windows 네이티브 PowerShell (이미지 클립보드)
- `vitest` (테스트)

## 3. Components

### 3.1 `core/sources/`

각 AI 어시스턴트의 JSONL 포맷을 공통 타입으로 정규화한다.

```typescript
type Exchange = {
  source: 'codex' | 'claude-code'
  sessionId: string
  sessionPath: string
  timestamp: Date
  user: { content: string }                       // markdown
  assistant: { content: string; model?: string }  // markdown
}

interface ChatSource {
  readonly id: 'codex' | 'claude-code'
  discoverSessions(): Promise<SessionFile[]>      // mtime 내림차순
  parseLastExchange(file: SessionFile): Promise<Exchange | null>
}
```

- **CodexSource**: `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl`
  - JSONL을 한 줄씩 스트리밍 파싱
  - Codex 포맷의 `response` 이벤트(role=user/assistant) 추출
- **ClaudeCodeSource**: `~/.claude/projects/<encoded-path>/<session-uuid>.jsonl`
  - role=user/assistant 추출, subagent 파일 무시
- 둘 다 **subagent / tool_use / tool_result / system 메시지는 기본 필터링** (사이드바 사용자 시야에 보이는 것만)

### 3.2 `core/selector/`

```typescript
async function selectLatestExchange(opts?: {
  source?: 'codex' | 'claude-code' | 'auto'   // 기본 'auto'
  sessionId?: string                          // 명시 지정
  workspaceHint?: string                      // VS Code 확장 모드용
}): Promise<Exchange>
```

- `auto`: 두 소스의 최근 JSONL의 mtime 비교 → 더 최근 것 채택 → 마지막 user→assistant 쌍 추출
- `workspaceHint` 전달 시 Claude Code의 `~/.claude/projects/<encoded>/` 매칭을 1순위 힌트로 사용
- `--source codex` 같은 명시 지정은 폴백 없이 그대로 존중

### 3.3 `core/theme/`

```typescript
type Theme = {
  name: string                  // 'carbon-dark' | 'paper-light' | 'velvet'
  background: string | Gradient
  padding: number               // outer 패딩 (Carbon 느낌)
  chrome: 'macos' | 'ai-badge' | 'none'   // 헤더 스타일
  cornerRadius: number
  shadow: ShadowSpec
  bubbleStyle: BubbleStyle      // user/assistant 말풍선 스타일
  codeTheme: ShikiThemeName     // 'github-dark' 등
  font: { sans: string; mono: string }    // 한글 폰트 fallback 체인 포함
}
```

v1 프리셋:
- **carbon-dark** (기본): 다크 그라데이션 배경, macOS chrome, github-dark 코드
- **paper-light**: 흰 배경 + 부드러운 섀도우, AI badge chrome
- **velvet**: 보라/핑크 그라데이션, github-light 코드

폰트는 **Pretendard**(한글) + **JetBrains Mono**(코드)를 `packages/core/assets/fonts/` 에 번들. v1은 단순/예측 가능한 UX를 위해 다운로드 방식 채택하지 않음 (Decision Log 참조).

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

기본 너비 **720px** (슬랙 미리보기 적정), 높이 가변. `--width` 옵션으로 변경.

### 3.5 `core/redact/`

세션 JSONL은 민감 정보를 포함할 수 있으므로 자동 마스킹.

- 패턴: `sk-...`, `gh[ps]_...`, JWT(`eyJ...`로 시작 + `.` 구분), AWS access key, Google API key 등
- 마스킹 시 stderr에 "Redacted N tokens (sk-***, JWT)" 경고
- `--include-system`, `--include-tools` 옵션은 명시적으로 켜야 동작

### 3.6 `core/output/`

- **이미지 모드** (기본):
  - PNG 파일 저장: 기본 `~/Pictures/Promptshot/YYYY-MM-DD_HH-mm-ss.png` (`--output` 으로 변경)
  - Windows 클립보드: PowerShell `Add-Type` + `System.Windows.Forms.Clipboard.SetImage()`
  - 둘 다 시도, 한쪽 실패해도 다른쪽은 진행
- **마크다운 모드** (`--format md`):
  - 텍스트 클립보드 (`clipboardy`)
  - 옵션으로 파일 저장 (`--output foo.md`)

### 3.7 `cli/`

```bash
promptshot                              # 자동 감지, 이미지 + 클립보드
promptshot --source codex               # Codex만
promptshot --format md                  # 마크다운 모드
promptshot --theme paper-light          # 테마 선택
promptshot --output ~/Desktop/foo.png   # 출력 경로
promptshot --list                       # 최근 세션 목록 (선택 가능)
promptshot --width 960                  # 너비 변경
promptshot --include-tools              # tool_use 메시지도 포함 (옵션)
```

종료 코드:
- `0` 성공 (파일 또는 클립보드 중 최소 하나 성공)
- `1` 일반 실패 (파싱/렌더 등)
- `2` 사용자 입력 오류 (잘못된 옵션)
- `13` 권한/접근 거부

### 3.8 `vscode-ext/`

명령:
- `Promptshot: Capture Last Exchange` (기본 `Ctrl+Alt+P`)
- `Promptshot: Capture as Markdown`
- `Promptshot: Choose Theme…`
- `Promptshot: Open Last Capture` (파일 매니저로 열기)

활성 워크스페이스 경로를 `workspaceHint`로 core selector에 전달.

## 4. Data Flow

```
[User: Ctrl+Alt+P 또는 `promptshot` 실행]
    │
    ▼
1. selector.selectLatestExchange({ source: 'auto', workspaceHint? })
    ├─ CodexSource.discoverSessions()       // mtime 정렬
    └─ ClaudeCodeSource.discoverSessions()  // mtime 정렬
    → 가장 최신 SessionFile 1개 결정
    │
    ▼
2. <Source>.parseLastExchange(file)
    JSONL 스트림 → user/assistant 필터
    → 마지막 user + 그 다음 assistant 쌍
    → Exchange 객체
    │
    ▼
3. (옵션) format === 'md' 분기
    → output.copyMarkdownToClipboard(exchange)
    → output.saveMarkdownToFile(exchange, path)  // --output 지정 시
    → 끝
    │ (이미지 모드 계속)
    ▼
4. redact.scan(exchange) → 마스킹 (필요 시)
    │
    ▼
5. render.renderExchange(exchange, theme)
    a. markdown → AST
    b. AST → Satori JSX 트리 (Shiki 적용)
    c. Satori(JSX) → SVG
    d. resvg(SVG) → PNG Buffer
    │
    ▼
6. output 단계 (병렬)
    ├─ saveToFile(buffer, path)
    └─ copyImageToClipboard(buffer)
    │
    ▼
[CLI: stdout에 저장 경로 + ✓ Clipboard ready 출력]
[Ext: Notification "Captured (450ms) · Open file?"]
```

### 4.1 이미지 레이아웃

```
┌─ Padding (그라데이션 배경) ────────────────┐
│ ╭─[Chrome: ● ● ●   Codex · 2분 전]──────╮│
│ │                                         ││
│ │ 👤 사용자 메시지 (마크다운 렌더링)       ││
│ │                                         ││
│ │ ────────────────                       ││
│ │                                         ││
│ │ 🤖 AI 응답 (Shiki 코드 하이라이트       ││
│ │    + 표/리스트/인라인 코드)             ││
│ │                                         ││
│ ╰─────────────────────────────────────────╯│
└────────────────────────────────────────────┘
        Drop shadow + 라운디드 코너
```

## 5. Error Handling & Edge Cases

### 5.1 환경/입력

| 상황 | 처리 |
|---|---|
| 두 소스 디렉토리 모두 없음 | `Error: No AI sessions found. Tried: …` + `PROMPTSHOT_CODEX_HOME` 안내 |
| JSONL 0개 | "0 sessions found. Have you used Codex/Claude Code recently?" |
| `--source codex` 인데 비어있음 | 폴백 안 함, 명시적 실패 |
| `--session-id` 매칭 안 됨 | `--list` 안내 |
| Windows 권한 부족 | exit 13 |

### 5.2 파싱

| 상황 | 처리 |
|---|---|
| 마지막 줄 truncated | 무시하고 그 전까지 |
| user 메시지만 있고 assistant 없음 | "Last exchange has no assistant response yet." |
| user/assistant 외 role만 존재 | 빈 결과 + 위 메시지 |
| schema 변경으로 파싱 실패 | schema version 체크 → 명확 에러 + raw line 일부 stderr |

### 5.3 렌더

| 상황 | 처리 |
|---|---|
| 한글 폰트 누락 | 번들된 Pretendard 사용 (시스템 폰트 의존 없음). 그래도 누락된 글리프는 fallback 체인 (Noto Sans CJK → system default) |
| Satori 미지원 CSS | 사전 화이트리스트 컴포넌트만 사용 |
| 매우 긴 메시지 (예: 100KB) | 기본은 전체 렌더, `--max-height` 초과시 하단 페이드 + "(truncated, N more lines)" |
| 이미지 첨부 | v1: `[image attachment]` placeholder, v2 인라인 임베드 |

### 5.4 출력

| 상황 | 처리 |
|---|---|
| 클립보드 실패 | 파일 저장은 성공시키고 경로 안내. exit 0 유지 |
| 파일 저장 실패 | 클립보드라도 시도. 둘 다 실패시 exit 1 |
| 파일명 충돌 | `_2`, `_3` suffix |

### 5.5 보안/프라이버시

- 기본은 사용자 시야 메시지(user/assistant)만 추출
- `--include-system`, `--include-tools`은 명시적 opt-in
- API 키/토큰 패턴 자동 마스킹 + stderr 경고
- 마스킹 규칙은 `core/redact/` 모듈로 분리 (단위 테스트 용이)

## 6. Testing Strategy

### 6.1 단위 테스트 (Vitest, 80%+ 커버리지)

| 모듈 | 대상 | 픽스처 |
|---|---|---|
| `core/sources/codex` | discoverSessions mtime 정렬, parseLastExchange 다양 케이스 | `fixtures/codex/*.jsonl` |
| `core/sources/claude-code` | 동일 + subagent 파일 무시 | `fixtures/claude-code/*.jsonl` |
| `core/selector` | auto 모드, source/sessionId 강제, 빈 결과 | mock fs |
| `core/render` | 마크다운 → JSX 매핑 (코드/표/리스트/인라인) | snapshot test (SVG) |
| `core/redact` | API 키/JWT/GitHub 토큰 마스킹 | 합성 입력 |
| `core/output` | 파일명 충돌 suffix, 권한 에러 | tmp dir |

### 6.2 통합 테스트

- CLI E2E: fixtures → `promptshot --output tmp.png` → PNG 메타 검증
- 이미지 검증: PNG width/height/format + 평균 색상 + 옵셔널 OCR
- 마크다운 모드: snapshot

### 6.3 VS Code 확장 테스트

- `@vscode/test-electron` 으로 실제 VS Code 인스턴스
- 명령 실행 → mock workspace + fixture 동작 검증
- 키바인딩 동작은 수동 체크

### 6.4 골든 이미지

- 3 테마 × 4 fixture(짧은/긴/코드포함/표포함) = 12장 골든 PNG
- `packages/core/test/__golden__/`
- 시각적 회귀는 PR 리뷰 시 사람 눈으로

### 6.5 CI

GitHub Actions:
- `pnpm install` → `pnpm test`
- Linux runner + `fonts-noto-cjk` 설치 후 렌더 테스트
- 매트릭스: Node 20 / Node 22

## 7. Open Questions

향후 결정 필요 (v1 진행 가능하지만 유의):

1. **Codex JSONL 정확한 스키마**: 구현 단계에서 실제 fixture로 검증 필요 (이벤트 타입명, role 필드 위치 등)
2. **VS Code 확장 배포**: marketplace 등록 vs sideload .vsix → v1은 sideload, v2에서 등록 고려
3. **세션 picker UI**: `--list` 결과를 CLI prompt로 보여줄지, VS Code QuickPick으로 보여줄지 → 둘 다, 일관된 UX 필요
4. **이미지 첨부 인라인**: Codex가 첨부 이미지 분석하는 케이스 → v2 후보
5. **GitHub Copilot Chat 추가 지원**: 같은 소스 어댑터 패턴으로 가능 → v2

## 8. Out of v1 Scope (Future)

- Cursor 채팅 지원
- 터미널 Shell Integration 캡쳐
- 임의 범위 선택 (메시지 N개)
- 전체 세션 길게 이미지화
- 웹 공유 (Carbon처럼 URL 생성)
- macOS / Linux 정식 지원

## 9. Decision Log

| 결정 | 대안 | 이유 |
|---|---|---|
| 재렌더링 방식 | OS 스크린샷 | 더 깔끔, DPI/스크롤 이슈 없음, 사용자가 명시적으로 선택 |
| Satori 렌더러 | Puppeteer | 가볍고 빠름, Chrome 의존 없음. 슬랙용 이미지엔 fidelity 충분 |
| 모노레포 | 단일 패키지 | core 재사용 + 의존성 누수 방지 |
| 마지막 1쌍 캡쳐 | 전체 세션 / viewport | 슬랙 공유에 적합한 단위, 사용자가 명시적으로 선택 |
| 이미지 우선 | 마크다운 우선 | 사용자가 명시적으로 선택 (슬랙/이메일) |
| 폰트 번들 | 첫 실행 다운로드 | 예측 가능한 UX, 오프라인 동작. 패키지 크기 ~1MB 증가는 허용 |

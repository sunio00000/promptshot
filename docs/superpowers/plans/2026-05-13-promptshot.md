# Promptshot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** VS Code 확장 Promptshot을 구현한다. Codex / Claude Code의 사이드바 마지막 user→assistant 한 쌍을 macOS 작업창 스타일의 PNG 이미지로 캡쳐해 클립보드와 파일로 저장, 또는 마크다운으로 클립보드에 복사한다. Cross-platform (Windows/macOS/Linux), Marketplace 정식 등록 대상.

**Architecture:** pnpm 모노레포의 `packages/core` (순수 TS, VS Code API 의존 없음) + `packages/vscode-ext` (확장). core는 단방향 의존 `sources → selector → render → output`. 이미지 클립보드는 hidden Webview의 `navigator.clipboard.write(ClipboardItem)` 으로 OS 무관 구현. 모든 의존성은 pure JS 또는 WebAssembly.

**Tech Stack:** TypeScript 5+, Node 20+, pnpm workspaces, Vitest, Satori, @resvg/resvg-js, Shiki, remark + remark-gfm, @vscode/test-electron.

**Spec:** `docs/superpowers/specs/2026-05-13-promptshot-design.md` (반드시 먼저 읽을 것)

**Decisions log:** `docs/DECISIONS.md` (구현 중 결정 발생 시 #002, #003... 으로 누적)

---

## Phase 0 — Cross-Platform PoC (구현 진입 전 검증)

### Task 0.1: `@resvg/resvg-js` + Satori 렌더 PoC

**Files:**
- Create: `poc/01-render/package.json`
- Create: `poc/01-render/index.mjs`
- Create: `poc/01-render/expected/hello.png` (검증 후 생성)

- [ ] **Step 1: poc 디렉토리에 최소 패키지 생성**

```bash
mkdir -p poc/01-render
cd poc/01-render
npm init -y
npm install satori @resvg/resvg-js
```

`poc/01-render/package.json` 의 `type` 을 `"module"` 로 변경.

- [ ] **Step 2: 최소 렌더 스크립트 작성**

`poc/01-render/index.mjs`:
```javascript
import satori from 'satori'
import { Resvg } from '@resvg/resvg-js'
import { writeFileSync, readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

// 한글이 들어간 간단한 카드
const tree = {
  type: 'div',
  props: {
    style: { display: 'flex', width: '400px', height: '200px', background: '#f5f5f7', padding: '24px', fontFamily: 'NotoSans' },
    children: { type: 'div', props: { children: 'Hello 안녕하세요 🎉' } }
  }
}

// 폰트 다운로드 (한 번만)
const fontPath = join(__dirname, 'NotoSansKR.ttf')
if (!existsSync(fontPath)) {
  const url = 'https://fonts.gstatic.com/s/notosanskr/v36/Pby6FmXiEBPT4ITbgNA5Cgm203Tq4JJWq209pU0DPdWuqxJFA4GNDCBYtw.ttf'
  const res = await fetch(url)
  writeFileSync(fontPath, Buffer.from(await res.arrayBuffer()))
}

const svg = await satori(tree, {
  width: 400,
  fonts: [{ name: 'NotoSans', data: readFileSync(fontPath), weight: 400, style: 'normal' }]
})
const png = new Resvg(svg).render().asPng()
writeFileSync(join(__dirname, 'hello.png'), png)
console.log('OK', png.length, 'bytes')
```

- [ ] **Step 3: 실행 검증 (Windows)**

```bash
cd poc/01-render
node index.mjs
```

Expected stdout: `OK <number> bytes`
Expected file: `poc/01-render/hello.png` 가 생성되고 한글 "안녕하세요"가 깨지지 않고 보임

- [ ] **Step 4: macOS/Linux 검증 — GitHub Actions로**

`.github/workflows/poc.yml`:
```yaml
name: poc
on: { workflow_dispatch: {} }
jobs:
  render-poc:
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: cd poc/01-render && npm install && node index.mjs
      - uses: actions/upload-artifact@v4
        with:
          name: hello-${{ matrix.os }}
          path: poc/01-render/hello.png
```

Run `workflow_dispatch` → 3 OS 모두 성공해야 함. 산출물 다운로드해 시각 확인.

- [ ] **Step 5: 결과를 DECISIONS.md에 기록 후 커밋**

`docs/DECISIONS.md` 최상단에 다음 형식으로 추가:

```markdown
## #002 — Cross-platform render PoC 통과

- **Date**: YYYY-MM-DD
- **Status**: Active

### Context

Spec의 "Cross-platform 검증 포인트 #1" — @resvg/resvg-js WebAssembly가 Windows/macOS/Linux 모두에서 npm install로 즉시 동작하고 한글 렌더가 깨지지 않는지 검증 필요.

### Decision

3 OS GitHub Actions 매트릭스로 렌더 PoC 통과 확인. Satori 0.x + @resvg/resvg-js 2.x 조합으로 진행.

### Consequences

- 본 설계의 핵심 가정(cross-platform 렌더)이 검증됨
- 구체적 라이브러리 버전 픽스: satori ^X.Y, @resvg/resvg-js ^A.B
```

```bash
git add poc/01-render docs/DECISIONS.md .github/workflows/poc.yml
git commit -m "poc: verify cross-platform Satori + resvg render"
```

### Task 0.2: Webview 이미지 클립보드 PoC

**Files:**
- Create: `poc/02-clipboard/extension.js`
- Create: `poc/02-clipboard/package.json`
- Create: `poc/02-clipboard/webview.html`

- [ ] **Step 1: 최소 VS Code 확장 스캐폴드**

`poc/02-clipboard/package.json`:
```json
{
  "name": "poc-clipboard",
  "engines": { "vscode": "^1.85.0" },
  "main": "./extension.js",
  "contributes": {
    "commands": [
      { "command": "pocClipboard.test", "title": "PoC: Image Clipboard Test" }
    ]
  },
  "activationEvents": ["onCommand:pocClipboard.test"]
}
```

- [ ] **Step 2: 확장 코드 — Webview 띄우고 이미지 base64 전달**

`poc/02-clipboard/extension.js`:
```javascript
const vscode = require('vscode')
const fs = require('node:fs')
const path = require('node:path')

function activate(context) {
  context.subscriptions.push(vscode.commands.registerCommand('pocClipboard.test', async () => {
    // 1x1 빨강 PNG (테스트용 작은 이미지)
    const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=='

    const panel = vscode.window.createWebviewPanel(
      'pocClipboard', 'PoC', vscode.ViewColumn.One,
      { enableScripts: true, retainContextWhenHidden: false }
    )
    const html = fs.readFileSync(path.join(__dirname, 'webview.html'), 'utf8')
    panel.webview.html = html

    panel.webview.onDidReceiveMessage(msg => {
      if (msg.type === 'ready') panel.webview.postMessage({ type: 'png', data: pngBase64 })
      if (msg.type === 'done') {
        vscode.window.showInformationMessage(msg.ok ? 'Clipboard OK' : `Clipboard FAIL: ${msg.error}`)
        panel.dispose()
      }
    })
  }))
}
exports.activate = activate
```

- [ ] **Step 3: Webview 코드 — 클립보드 쓰기 시도**

`poc/02-clipboard/webview.html`:
```html
<!doctype html><html><body>
<script>
  const vscode = acquireVsCodeApi()
  vscode.postMessage({ type: 'ready' })
  window.addEventListener('message', async (ev) => {
    if (ev.data.type !== 'png') return
    try {
      const res = await fetch('data:image/png;base64,' + ev.data.data)
      const blob = await res.blob()
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      vscode.postMessage({ type: 'done', ok: true })
    } catch (e) {
      vscode.postMessage({ type: 'done', ok: false, error: String(e) })
    }
  })
</script>
</body></html>
```

- [ ] **Step 4: Extension Development Host로 수동 검증**

VS Code에서 `poc/02-clipboard` 폴더 열고 `F5` (Extension Development Host 실행) → Command Palette → `PoC: Image Clipboard Test` 실행. 알림에 "Clipboard OK" 떠야 함. 그림판/Slack에 `Ctrl+V` 해서 빨간 픽셀 1x1 붙여넣어지는지 확인.

- [ ] **Step 5: 결과 기록 & 커밋**

`docs/DECISIONS.md` 에 `#003` 추가:
- Webview 클립보드 PoC 결과 (성공/실패, 권한 프롬프트 발생 여부)
- 만약 실패 시 → 대안 결정 (예: 파일만 저장하고 "Reveal in folder" 버튼 제공)

```bash
git add poc/02-clipboard docs/DECISIONS.md
git commit -m "poc: verify webview image clipboard"
```

---

## Phase 1 — Project Scaffolding

### Task 1.1: 모노레포 셋업

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `.gitignore`
- Create: `.editorconfig`
- Create: `README.md`

- [ ] **Step 1: 워크스페이스 루트 파일들**

`pnpm-workspace.yaml`:
```yaml
packages:
  - 'packages/*'
```

`package.json` (root):
```json
{
  "name": "promptshot-workspace",
  "private": true,
  "scripts": {
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "lint": "pnpm -r lint"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "vitest": "^1.6.0"
  },
  "packageManager": "pnpm@9.0.0"
}
```

`tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "sourceMap": true
  }
}
```

`.gitignore`:
```
node_modules
dist
*.vsix
.DS_Store
*.log
poc/*/node_modules
```

`.editorconfig`:
```ini
root = true
[*]
indent_style = space
indent_size = 2
charset = utf-8
end_of_line = lf
insert_final_newline = true
```

`README.md` (간단히):
```markdown
# Promptshot

Capture VS Code's secondary-sidebar AI chat (Codex / Claude Code) into beautiful PNG / markdown for sharing.

See [design spec](docs/superpowers/specs/2026-05-13-promptshot-design.md).
```

- [ ] **Step 2: pnpm install 실행**

```bash
pnpm install
```

Expected: `node_modules/` 생성, lockfile `pnpm-lock.yaml` 생성, 에러 없음.

- [ ] **Step 3: 커밋**

```bash
git add package.json pnpm-workspace.yaml tsconfig.base.json .gitignore .editorconfig README.md pnpm-lock.yaml
git commit -m "chore: scaffold pnpm monorepo"
```

### Task 1.2: `packages/core` 패키지 셋업

**Files:**
- Create: `packages/core/package.json`
- Create: `packages/core/tsconfig.json`
- Create: `packages/core/vitest.config.ts`
- Create: `packages/core/src/index.ts`

- [ ] **Step 1: core 패키지 파일들**

`packages/core/package.json`:
```json
{
  "name": "@promptshot/core",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@resvg/resvg-js": "^2.6.0",
    "remark": "^15.0.0",
    "remark-gfm": "^4.0.0",
    "remark-parse": "^11.0.0",
    "satori": "^0.10.0",
    "shiki": "^1.0.0",
    "unified": "^11.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.4.0",
    "vitest": "^1.6.0"
  }
}
```

`packages/core/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*"]
}
```

`packages/core/vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 }
    }
  }
})
```

`packages/core/src/index.ts`:
```typescript
export {}
```

- [ ] **Step 2: 설치 및 빌드 검증**

```bash
pnpm install
pnpm -C packages/core build
```

Expected: `packages/core/dist/index.js` 생성, 에러 없음.

- [ ] **Step 3: 커밋**

```bash
git add packages/core/
git commit -m "chore: scaffold @promptshot/core package"
```

### Task 1.3: `packages/vscode-ext` 패키지 셋업

**Files:**
- Create: `packages/vscode-ext/package.json`
- Create: `packages/vscode-ext/tsconfig.json`
- Create: `packages/vscode-ext/src/extension.ts`
- Create: `packages/vscode-ext/.vscodeignore`

- [ ] **Step 1: 확장 파일들**

`packages/vscode-ext/package.json`:
```json
{
  "name": "promptshot",
  "displayName": "Promptshot — Beautiful AI Chat Captures",
  "description": "Capture Codex / Claude Code sidebar exchanges as shareable PNG or markdown.",
  "version": "0.0.1",
  "private": false,
  "publisher": "TBD-set-before-publish",
  "engines": { "vscode": "^1.85.0" },
  "categories": ["Visualization", "Other"],
  "keywords": ["ai", "chat", "screenshot", "claude", "codex", "share", "carbon"],
  "main": "./dist/extension.js",
  "activationEvents": [
    "onCommand:promptshot.captureLastExchange",
    "onCommand:promptshot.captureAsMarkdown",
    "onCommand:promptshot.pickSession",
    "onCommand:promptshot.chooseTheme",
    "onCommand:promptshot.openLastCapture"
  ],
  "contributes": {
    "commands": [
      { "command": "promptshot.captureLastExchange", "title": "Promptshot: Capture Last Exchange" },
      { "command": "promptshot.captureAsMarkdown", "title": "Promptshot: Capture as Markdown" },
      { "command": "promptshot.pickSession", "title": "Promptshot: Pick Session…" },
      { "command": "promptshot.chooseTheme", "title": "Promptshot: Choose Theme…" },
      { "command": "promptshot.openLastCapture", "title": "Promptshot: Open Last Capture" }
    ],
    "keybindings": [
      { "command": "promptshot.captureLastExchange", "key": "ctrl+alt+p", "mac": "cmd+alt+p" }
    ],
    "configuration": {
      "title": "Promptshot",
      "properties": {
        "promptshot.theme":   { "type": "string", "enum": ["mac-light", "mac-dark"], "default": "mac-light" },
        "promptshot.source":  { "type": "string", "enum": ["auto", "codex", "claude-code"], "default": "auto" },
        "promptshot.outputDir": { "type": "string", "default": "" },
        "promptshot.width":   { "type": "number", "default": 720 },
        "promptshot.maxHeight": { "type": "number", "default": 4000 },
        "promptshot.includeTools": { "type": "boolean", "default": false },
        "promptshot.includeSystem": { "type": "boolean", "default": false }
      }
    }
  },
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "package": "vsce package --no-dependencies"
  },
  "dependencies": {
    "@promptshot/core": "workspace:*"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/vscode": "^1.85.0",
    "@vscode/test-electron": "^2.4.0",
    "@vscode/vsce": "^2.27.0",
    "typescript": "^5.4.0",
    "vitest": "^1.6.0"
  }
}
```

`packages/vscode-ext/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "module": "commonjs",
    "moduleResolution": "node"
  },
  "include": ["src/**/*"]
}
```

(VS Code 확장 런타임은 CommonJS이므로 core(ESM)와 모듈 시스템이 다름. core를 빌드 시 dual package로 만들거나 vscode-ext에서 dynamic import 사용 — 다음 단계에서 결정. 일단 commonjs로 두고 진행하다 충돌 발생 시 core를 dual-publish로 변경.)

`packages/vscode-ext/src/extension.ts`:
```typescript
import * as vscode from 'vscode'

export function activate(_context: vscode.ExtensionContext): void {
  // Commands wired up in later tasks.
}

export function deactivate(): void {}
```

`packages/vscode-ext/.vscodeignore`:
```
src/**
tsconfig.json
vitest.config.ts
test/**
node_modules/.cache
```

- [ ] **Step 2: 설치 및 빌드 검증**

```bash
pnpm install
pnpm -C packages/vscode-ext build
```

Expected: `packages/vscode-ext/dist/extension.js` 생성.

- [ ] **Step 3: 커밋**

```bash
git add packages/vscode-ext/
git commit -m "chore: scaffold promptshot VS Code extension package"
```

### Task 1.4: GitHub Actions CI 매트릭스

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: CI 워크플로 작성**

`.github/workflows/ci.yml`:
```yaml
name: ci
on:
  push: { branches: [main] }
  pull_request:
jobs:
  test:
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
        node: [20, 22]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node }}
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm -r build
      - run: pnpm -r test
```

- [ ] **Step 2: 푸시 후 CI 통과 확인**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add cross-platform test matrix"
git push
```

Expected: GitHub Actions 페이지에서 ubuntu/macos/windows × Node 20/22 = 6 잡이 모두 녹색이어야 함.

---

## Phase 2 — Core: Types & Sources

### Task 2.1: Exchange 타입 + ChatSource 인터페이스

**Files:**
- Create: `packages/core/src/types.ts`
- Create: `packages/core/src/sources/types.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: 타입 정의**

`packages/core/src/types.ts`:
```typescript
export type SourceId = 'codex' | 'claude-code'

export type Exchange = {
  source: SourceId
  sourceLabel: string
  sessionId: string
  sessionPath: string
  timestamp: Date
  user: { content: string }
  assistant: { content: string; model?: string }
}

export type SessionFile = {
  path: string
  mtime: Date
}
```

`packages/core/src/sources/types.ts`:
```typescript
import type { Exchange, SessionFile, SourceId } from '../types.js'

export interface ChatSource {
  readonly id: SourceId
  readonly label: string
  discoverSessions(): Promise<SessionFile[]>
  parseLastExchange(file: SessionFile): Promise<Exchange | null>
}
```

`packages/core/src/index.ts`:
```typescript
export * from './types.js'
export type { ChatSource } from './sources/types.js'
```

- [ ] **Step 2: 빌드 확인**

```bash
pnpm -C packages/core build
```

Expected: 에러 없음.

- [ ] **Step 3: 커밋**

```bash
git add packages/core/src/
git commit -m "feat(core): add Exchange type and ChatSource interface"
```

### Task 2.2: CodexSource — fixtures 준비

**Files:**
- Create: `packages/core/test/fixtures/codex/normal.jsonl`
- Create: `packages/core/test/fixtures/codex/truncated.jsonl`
- Create: `packages/core/test/fixtures/codex/no-assistant.jsonl`

> 실제 Codex JSONL 스키마는 구현 단계에서 검증해야 한다 (spec Open Questions #3). 일단 사용자 로컬 `~/.codex/sessions/` 에서 가장 최근 파일을 하나 열어서 schema를 확인하고 그에 맞춰 fixtures를 만든다.

- [ ] **Step 1: 사용자 로컬에서 실제 Codex JSONL 한 줄 샘플링**

```bash
node -e "
const fs = require('fs'), path = require('path'), os = require('os');
const root = path.join(os.homedir(), '.codex', 'sessions');
function walk(p) { return fs.statSync(p).isDirectory() ? fs.readdirSync(p).flatMap(c => walk(path.join(p,c))) : [p]; }
const files = walk(root).filter(f => f.endsWith('.jsonl')).sort((a,b) => fs.statSync(b).mtime - fs.statSync(a).mtime);
const lines = fs.readFileSync(files[0], 'utf8').trim().split('\n');
console.log('=== file ===\n' + files[0]);
console.log('=== first 3 lines ===');
lines.slice(0,3).forEach(l => console.log(JSON.parse(l)));
console.log('=== last 3 lines ===');
lines.slice(-3).forEach(l => console.log(JSON.parse(l)));
"
```

스키마를 확인해 fixtures에 정확한 포맷을 반영. (예: `{ type: 'response', role: 'user'|'assistant', content: '...' }` 같은 구조를 가정하지만 실제는 다를 수 있음.)

- [ ] **Step 2: `normal.jsonl` 작성** (실제 Codex 포맷에 맞춰)

3 turn(user1, assistant1, user2, assistant2)을 가진 합성 데이터. 실제 사용자 메시지/assistant 응답 흉내. **반드시 Step 1 결과의 실제 키 이름을 사용.**

- [ ] **Step 3: `truncated.jsonl` 작성**

`normal.jsonl` 의 마지막 줄에서 중간을 잘라 무효 JSON으로 만든 버전. 파싱 시 마지막 줄은 무시되어야 함.

- [ ] **Step 4: `no-assistant.jsonl` 작성**

user만 1개, assistant 없는 데이터. parser는 `null` 반환해야 함.

- [ ] **Step 5: 커밋**

```bash
git add packages/core/test/fixtures/codex/
git commit -m "test(core): add Codex fixtures (normal, truncated, no-assistant)"
```

### Task 2.3: CodexSource 구현

**Files:**
- Create: `packages/core/src/sources/codex.ts`
- Create: `packages/core/test/sources/codex.test.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`packages/core/test/sources/codex.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { resolve } from 'node:path'
import { CodexSource } from '../../src/sources/codex.js'

const fx = (name: string) => resolve(__dirname, '../fixtures/codex', name)

describe('CodexSource', () => {
  const source = new CodexSource({ rootDir: resolve(__dirname, '../fixtures/codex') })

  it('id and label', () => {
    expect(source.id).toBe('codex')
    expect(source.label).toBe('Codex')
  })

  it('discoverSessions returns mtime-sorted jsonl files', async () => {
    const files = await source.discoverSessions()
    expect(files.length).toBeGreaterThan(0)
    expect(files.every(f => f.path.endsWith('.jsonl'))).toBe(true)
    // mtime 내림차순
    for (let i = 1; i < files.length; i++) {
      expect(files[i - 1].mtime.getTime()).toBeGreaterThanOrEqual(files[i].mtime.getTime())
    }
  })

  it('parseLastExchange returns last user-assistant pair from normal fixture', async () => {
    const file = { path: fx('normal.jsonl'), mtime: new Date() }
    const ex = await source.parseLastExchange(file)
    expect(ex).not.toBeNull()
    expect(ex!.source).toBe('codex')
    expect(ex!.user.content).toBeTruthy()
    expect(ex!.assistant.content).toBeTruthy()
  })

  it('parseLastExchange ignores truncated last line', async () => {
    const file = { path: fx('truncated.jsonl'), mtime: new Date() }
    const ex = await source.parseLastExchange(file)
    expect(ex).not.toBeNull()  // 그 전까지로 파싱
  })

  it('parseLastExchange returns null when no assistant response yet', async () => {
    const file = { path: fx('no-assistant.jsonl'), mtime: new Date() }
    const ex = await source.parseLastExchange(file)
    expect(ex).toBeNull()
  })
})
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
pnpm -C packages/core test
```

Expected: `Cannot find module '.../codex.js'` 또는 유사한 import 에러.

- [ ] **Step 3: 구현**

`packages/core/src/sources/codex.ts`:
```typescript
import { readdir, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { homedir } from 'node:os'
import type { ChatSource } from './types.js'
import type { Exchange, SessionFile } from '../types.js'

export class CodexSource implements ChatSource {
  readonly id = 'codex' as const
  readonly label = 'Codex'
  private readonly rootDir: string

  constructor(opts?: { rootDir?: string }) {
    this.rootDir = opts?.rootDir ?? join(homedir(), '.codex', 'sessions')
  }

  async discoverSessions(): Promise<SessionFile[]> {
    const files: SessionFile[] = []
    await this.walk(this.rootDir, files)
    files.sort((a, b) => b.mtime.getTime() - a.mtime.getTime())
    return files
  }

  private async walk(dir: string, out: SessionFile[]): Promise<void> {
    let entries
    try { entries = await readdir(dir, { withFileTypes: true }) } catch { return }
    for (const e of entries) {
      const p = join(dir, e.name)
      if (e.isDirectory()) await this.walk(p, out)
      else if (e.isFile() && e.name.endsWith('.jsonl')) {
        const s = await stat(p)
        out.push({ path: p, mtime: s.mtime })
      }
    }
  }

  async parseLastExchange(file: SessionFile): Promise<Exchange | null> {
    const text = await readFile(file.path, 'utf8')
    const lines = text.split('\n').filter(Boolean)
    const events: Array<{ role: 'user' | 'assistant'; content: string }> = []

    for (const line of lines) {
      let obj: unknown
      try { obj = JSON.parse(line) } catch { continue }  // 마지막 truncated 라인 무시
      const ev = this.toUserAssistantEvent(obj)
      if (ev) events.push(ev)
    }

    // 마지막 assistant 응답 + 그 직전 user 메시지 찾기
    const lastAssistantIdx = events.findLastIndex(e => e.role === 'assistant')
    if (lastAssistantIdx === -1) return null
    const lastUserIdx = events.slice(0, lastAssistantIdx).findLastIndex(e => e.role === 'user')
    if (lastUserIdx === -1) return null

    return {
      source: 'codex',
      sourceLabel: 'Codex',
      sessionId: file.path.split(/[\\/]/).pop()!.replace(/\.jsonl$/, ''),
      sessionPath: file.path,
      timestamp: file.mtime,
      user: { content: events[lastUserIdx].content },
      assistant: { content: events[lastAssistantIdx].content }
    }
  }

  // Codex JSONL의 실제 schema에 맞춰 user/assistant 메시지만 추출.
  // Task 2.2에서 확인한 실제 키 이름을 여기에 반영한다.
  private toUserAssistantEvent(obj: unknown): { role: 'user' | 'assistant'; content: string } | null {
    if (!obj || typeof obj !== 'object') return null
    const o = obj as Record<string, unknown>
    // 예시 schema 가정 (실제 검증 결과로 교체):
    //   { type: 'response' | 'message', role: 'user' | 'assistant', content: string }
    const role = o.role
    const content = o.content
    if ((role === 'user' || role === 'assistant') && typeof content === 'string') {
      return { role, content }
    }
    return null
  }
}
```

`packages/core/src/index.ts` 에 export 추가:
```typescript
export * from './types.js'
export type { ChatSource } from './sources/types.js'
export { CodexSource } from './sources/codex.js'
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
pnpm -C packages/core test
```

Expected: 5/5 통과.

- [ ] **Step 5: 커밋**

```bash
git add packages/core/src/sources/codex.ts packages/core/src/index.ts packages/core/test/sources/codex.test.ts
git commit -m "feat(core): implement CodexSource with discover and parseLastExchange"
```

### Task 2.4: ClaudeCodeSource — fixtures

**Files:**
- Create: `packages/core/test/fixtures/claude-code/normal.jsonl`
- Create: `packages/core/test/fixtures/claude-code/subagents/agent-xxx.jsonl`
- Create: `packages/core/test/fixtures/claude-code/no-assistant.jsonl`

- [ ] **Step 1: 사용자 로컬 Claude Code JSONL 샘플링**

```bash
node -e "
const fs = require('fs'), path = require('path'), os = require('os');
const root = path.join(os.homedir(), '.claude', 'projects');
const dirs = fs.readdirSync(root);
const last = dirs.map(d => ({ d, m: fs.statSync(path.join(root,d)).mtimeMs })).sort((a,b)=>b.m-a.m)[0];
const sessions = fs.readdirSync(path.join(root, last.d), { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name);
console.log('latest project:', last.d, 'sessions:', sessions.length);
const sessionDir = path.join(root, last.d, sessions[0]);
const files = fs.readdirSync(sessionDir);
console.log('session files:', files);
// 본 세션 JSONL과 subagent JSONL 첫 줄 확인
"
```

- [ ] **Step 2: `normal.jsonl` 작성**

Claude Code 메인 세션 포맷에 맞춰 user/assistant 2턴 작성.

- [ ] **Step 3: `subagents/agent-xxx.jsonl` 작성**

subagent 파일은 무시되어야 함을 검증하기 위한 더미.

- [ ] **Step 4: `no-assistant.jsonl` 작성**

user만 있는 경우.

- [ ] **Step 5: 커밋**

```bash
git add packages/core/test/fixtures/claude-code/
git commit -m "test(core): add Claude Code fixtures"
```

### Task 2.5: ClaudeCodeSource 구현

**Files:**
- Create: `packages/core/src/sources/claude-code.ts`
- Create: `packages/core/test/sources/claude-code.test.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`packages/core/test/sources/claude-code.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { resolve } from 'node:path'
import { ClaudeCodeSource } from '../../src/sources/claude-code.js'

const fx = (name: string) => resolve(__dirname, '../fixtures/claude-code', name)

describe('ClaudeCodeSource', () => {
  const source = new ClaudeCodeSource({ projectsDir: resolve(__dirname, '../fixtures/claude-code') })

  it('ignores subagent jsonl files in discovery', async () => {
    const files = await source.discoverSessions()
    expect(files.every(f => !f.path.includes('subagents'))).toBe(true)
  })

  it('parseLastExchange returns user-assistant pair', async () => {
    const file = { path: fx('normal.jsonl'), mtime: new Date() }
    const ex = await source.parseLastExchange(file)
    expect(ex).not.toBeNull()
    expect(ex!.source).toBe('claude-code')
    expect(ex!.user.content).toBeTruthy()
    expect(ex!.assistant.content).toBeTruthy()
  })

  it('returns null when no assistant response', async () => {
    const file = { path: fx('no-assistant.jsonl'), mtime: new Date() }
    const ex = await source.parseLastExchange(file)
    expect(ex).toBeNull()
  })
})
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
pnpm -C packages/core test -- claude-code
```

Expected: import 에러.

- [ ] **Step 3: 구현**

`packages/core/src/sources/claude-code.ts`:
```typescript
import { readdir, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { homedir } from 'node:os'
import type { ChatSource } from './types.js'
import type { Exchange, SessionFile } from '../types.js'

export class ClaudeCodeSource implements ChatSource {
  readonly id = 'claude-code' as const
  readonly label = 'Claude Code'
  private readonly projectsDir: string

  constructor(opts?: { projectsDir?: string }) {
    this.projectsDir = opts?.projectsDir ?? join(homedir(), '.claude', 'projects')
  }

  async discoverSessions(): Promise<SessionFile[]> {
    const files: SessionFile[] = []
    await this.walk(this.projectsDir, files)
    files.sort((a, b) => b.mtime.getTime() - a.mtime.getTime())
    return files
  }

  private async walk(dir: string, out: SessionFile[]): Promise<void> {
    let entries
    try { entries = await readdir(dir, { withFileTypes: true }) } catch { return }
    for (const e of entries) {
      const p = join(dir, e.name)
      if (e.isDirectory()) {
        if (e.name === 'subagents') continue  // 무시
        await this.walk(p, out)
      } else if (e.isFile() && e.name.endsWith('.jsonl')) {
        const s = await stat(p)
        out.push({ path: p, mtime: s.mtime })
      }
    }
  }

  async parseLastExchange(file: SessionFile): Promise<Exchange | null> {
    const text = await readFile(file.path, 'utf8')
    const lines = text.split('\n').filter(Boolean)
    const events: Array<{ role: 'user' | 'assistant'; content: string }> = []

    for (const line of lines) {
      let obj: unknown
      try { obj = JSON.parse(line) } catch { continue }
      const ev = this.toUserAssistantEvent(obj)
      if (ev) events.push(ev)
    }

    const lastAssistantIdx = events.findLastIndex(e => e.role === 'assistant')
    if (lastAssistantIdx === -1) return null
    const lastUserIdx = events.slice(0, lastAssistantIdx).findLastIndex(e => e.role === 'user')
    if (lastUserIdx === -1) return null

    return {
      source: 'claude-code',
      sourceLabel: 'Claude Code',
      sessionId: file.path.split(/[\\/]/).pop()!.replace(/\.jsonl$/, ''),
      sessionPath: file.path,
      timestamp: file.mtime,
      user: { content: events[lastUserIdx].content },
      assistant: { content: events[lastAssistantIdx].content }
    }
  }

  // Claude Code JSONL schema에 맞춰 구현. 실제 schema는 Task 2.4에서 확인.
  private toUserAssistantEvent(obj: unknown): { role: 'user' | 'assistant'; content: string } | null {
    if (!obj || typeof obj !== 'object') return null
    const o = obj as Record<string, unknown>
    // Claude Code 포맷 예시: { type: 'message', message: { role, content } }
    const msg = o.message as Record<string, unknown> | undefined
    if (!msg) return null
    const role = msg.role
    if (role !== 'user' && role !== 'assistant') return null

    // content는 문자열일 수도, content blocks 배열일 수도 있음
    const content = msg.content
    if (typeof content === 'string') return { role, content }
    if (Array.isArray(content)) {
      // text 블록만 합치기 (tool_use 등 제외)
      const text = content
        .filter((b: unknown) => (b as { type?: string })?.type === 'text')
        .map((b: { text?: string }) => b.text ?? '')
        .join('\n')
      if (text) return { role, content: text }
    }
    return null
  }
}
```

`packages/core/src/index.ts` 에 export 추가:
```typescript
export { ClaudeCodeSource } from './sources/claude-code.js'
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
pnpm -C packages/core test
```

Expected: Codex 5 + Claude Code 3 = 8 모두 통과.

- [ ] **Step 5: 커밋**

```bash
git add packages/core/src/sources/claude-code.ts packages/core/src/index.ts packages/core/test/sources/claude-code.test.ts
git commit -m "feat(core): implement ClaudeCodeSource (ignores subagents)"
```

---

## Phase 3 — Core: Selector

### Task 3.1: selectLatestExchange

**Files:**
- Create: `packages/core/src/selector/index.ts`
- Create: `packages/core/test/selector.test.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`packages/core/test/selector.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { resolve } from 'node:path'
import { selectLatestExchange } from '../src/selector/index.js'

const codexDir = resolve(__dirname, 'fixtures/codex')
const claudeDir = resolve(__dirname, 'fixtures/claude-code')

describe('selectLatestExchange', () => {
  it('auto picks the more recently modified source', async () => {
    const ex = await selectLatestExchange({
      source: 'auto',
      codexRoot: codexDir,
      claudeProjectsRoot: claudeDir
    })
    expect(ex).not.toBeNull()
    expect(['codex', 'claude-code']).toContain(ex!.source)
  })

  it('source: codex returns codex result', async () => {
    const ex = await selectLatestExchange({
      source: 'codex',
      codexRoot: codexDir,
      claudeProjectsRoot: claudeDir
    })
    expect(ex!.source).toBe('codex')
  })

  it('source: claude-code returns claude-code result', async () => {
    const ex = await selectLatestExchange({
      source: 'claude-code',
      codexRoot: codexDir,
      claudeProjectsRoot: claudeDir
    })
    expect(ex!.source).toBe('claude-code')
  })

  it('source: codex throws when codex has no sessions', async () => {
    await expect(
      selectLatestExchange({ source: 'codex', codexRoot: '/nonexistent', claudeProjectsRoot: claudeDir })
    ).rejects.toThrow(/no Codex sessions/i)
  })
})
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
pnpm -C packages/core test -- selector
```

- [ ] **Step 3: 구현**

`packages/core/src/selector/index.ts`:
```typescript
import { CodexSource } from '../sources/codex.js'
import { ClaudeCodeSource } from '../sources/claude-code.js'
import type { Exchange, SourceId } from '../types.js'

export type SelectOptions = {
  source?: SourceId | 'auto'
  sessionId?: string
  workspaceHint?: string
  codexRoot?: string             // 테스트/오버라이드용
  claudeProjectsRoot?: string    // 테스트/오버라이드용
}

export async function selectLatestExchange(opts: SelectOptions = {}): Promise<Exchange | null> {
  const source = opts.source ?? 'auto'
  const codex = new CodexSource({ rootDir: opts.codexRoot })
  const claude = new ClaudeCodeSource({ projectsDir: opts.claudeProjectsRoot })

  if (source === 'codex') {
    const files = await codex.discoverSessions()
    if (files.length === 0) throw new Error('no Codex sessions found')
    return codex.parseLastExchange(files[0])
  }
  if (source === 'claude-code') {
    const files = await claude.discoverSessions()
    if (files.length === 0) throw new Error('no Claude Code sessions found')
    return claude.parseLastExchange(files[0])
  }

  // auto: 두 source 최신 파일의 mtime 비교
  const [codexFiles, claudeFiles] = await Promise.all([
    codex.discoverSessions(),
    claude.discoverSessions()
  ])
  const candidates: Array<{ src: CodexSource | ClaudeCodeSource; file: { path: string; mtime: Date } }> = []
  if (codexFiles[0]) candidates.push({ src: codex, file: codexFiles[0] })
  if (claudeFiles[0]) candidates.push({ src: claude, file: claudeFiles[0] })
  if (candidates.length === 0) throw new Error('no AI sessions found in Codex or Claude Code')

  candidates.sort((a, b) => b.file.mtime.getTime() - a.file.mtime.getTime())
  return candidates[0].src.parseLastExchange(candidates[0].file)
}
```

`packages/core/src/index.ts` 에 export 추가:
```typescript
export { selectLatestExchange } from './selector/index.js'
export type { SelectOptions } from './selector/index.js'
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
pnpm -C packages/core test
```

Expected: 모든 테스트 통과.

- [ ] **Step 5: 커밋**

```bash
git add packages/core/src/selector/ packages/core/src/index.ts packages/core/test/selector.test.ts
git commit -m "feat(core): add selectLatestExchange with auto / source-pinned modes"
```

---

## Phase 4 — Core: Redact

### Task 4.1: 토큰 마스킹

**Files:**
- Create: `packages/core/src/redact/patterns.ts`
- Create: `packages/core/src/redact/index.ts`
- Create: `packages/core/test/redact.test.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`packages/core/test/redact.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { redactSecrets } from '../src/redact/index.js'

describe('redactSecrets', () => {
  it('masks OpenAI sk- keys', () => {
    const { text, hits } = redactSecrets('use this: sk-abc123def456ghi789jkl012mno345pqr678stuv')
    expect(text).not.toContain('sk-abc123')
    expect(text).toMatch(/sk-\*{3,}/)
    expect(hits).toContain('openai')
  })

  it('masks GitHub tokens', () => {
    const { text, hits } = redactSecrets('token ghp_1234567890abcdef1234567890abcdef12345678')
    expect(text).not.toContain('ghp_1234567890abcdef')
    expect(hits).toContain('github')
  })

  it('masks JWT', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NSJ9.SflKxwRJ'
    const { text, hits } = redactSecrets('Authorization: Bearer ' + jwt)
    expect(text).not.toContain(jwt)
    expect(hits).toContain('jwt')
  })

  it('preserves non-secret text', () => {
    const { text, hits } = redactSecrets('hello world, no secrets here')
    expect(text).toBe('hello world, no secrets here')
    expect(hits).toEqual([])
  })
})
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
pnpm -C packages/core test -- redact
```

- [ ] **Step 3: 구현**

`packages/core/src/redact/patterns.ts`:
```typescript
export type RedactPattern = { name: string; regex: RegExp }

export const PATTERNS: RedactPattern[] = [
  { name: 'openai',  regex: /sk-[A-Za-z0-9]{20,}/g },
  { name: 'github',  regex: /gh[ps]_[A-Za-z0-9]{30,}/g },
  { name: 'jwt',     regex: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}/g },
  { name: 'aws',     regex: /AKIA[0-9A-Z]{16}/g },
  { name: 'google',  regex: /AIza[0-9A-Za-z_-]{35}/g }
]
```

`packages/core/src/redact/index.ts`:
```typescript
import { PATTERNS } from './patterns.js'

export function redactSecrets(text: string): { text: string; hits: string[] } {
  const hits: string[] = []
  let out = text
  for (const p of PATTERNS) {
    if (p.regex.test(out)) {
      hits.push(p.name)
      out = out.replace(p.regex, (m) => m.slice(0, 3) + '*'.repeat(Math.max(3, m.length - 3)))
    }
    p.regex.lastIndex = 0  // global regex state 리셋
  }
  return { text: out, hits }
}
```

`packages/core/src/index.ts` 에 export 추가:
```typescript
export { redactSecrets } from './redact/index.js'
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
pnpm -C packages/core test -- redact
```

Expected: 4/4 통과.

- [ ] **Step 5: 커밋**

```bash
git add packages/core/src/redact/ packages/core/src/index.ts packages/core/test/redact.test.ts
git commit -m "feat(core): add redactSecrets for API keys, tokens, JWT"
```

---

## Phase 5 — Core: Theme & Fonts

### Task 5.1: Theme 타입 + 프리셋

**Files:**
- Create: `packages/core/src/theme/types.ts`
- Create: `packages/core/src/theme/mac-light.ts`
- Create: `packages/core/src/theme/mac-dark.ts`
- Create: `packages/core/src/theme/index.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Theme 타입과 프리셋**

`packages/core/src/theme/types.ts`:
```typescript
export type Theme = {
  name: 'mac-light' | 'mac-dark'
  outerBackground: string
  outerPadding: number
  windowBackground: string
  windowBorder: string
  cornerRadius: number
  shadowColor: string
  textPrimary: string
  textSecondary: string
  chromeBackground: string
  trafficLightColors: [string, string, string]  // red, yellow, green
  codeTheme: 'github-light' | 'github-dark'
  font: { sans: string; mono: string }
}
```

`packages/core/src/theme/mac-light.ts`:
```typescript
import type { Theme } from './types.js'

export const macLight: Theme = {
  name: 'mac-light',
  outerBackground: '#f5f5f7',
  outerPadding: 32,
  windowBackground: '#ffffff',
  windowBorder: '#e5e5ea',
  cornerRadius: 12,
  shadowColor: 'rgba(0,0,0,0.10)',
  textPrimary: '#1d1d1f',
  textSecondary: '#6e6e73',
  chromeBackground: '#f6f6f6',
  trafficLightColors: ['#ff5f57', '#ffbd2e', '#28c93f'],
  codeTheme: 'github-light',
  font: { sans: 'Pretendard', mono: 'JetBrains Mono' }
}
```

`packages/core/src/theme/mac-dark.ts`:
```typescript
import type { Theme } from './types.js'

export const macDark: Theme = {
  name: 'mac-dark',
  outerBackground: '#1e1e1e',
  outerPadding: 32,
  windowBackground: '#2c2c2e',
  windowBorder: '#3a3a3c',
  cornerRadius: 12,
  shadowColor: 'rgba(0,0,0,0.45)',
  textPrimary: '#f2f2f7',
  textSecondary: '#aeaeb2',
  chromeBackground: '#3a3a3c',
  trafficLightColors: ['#ff5f57', '#ffbd2e', '#28c93f'],
  codeTheme: 'github-dark',
  font: { sans: 'Pretendard', mono: 'JetBrains Mono' }
}
```

`packages/core/src/theme/index.ts`:
```typescript
import { macLight } from './mac-light.js'
import { macDark } from './mac-dark.js'
import type { Theme } from './types.js'

export const themes: Record<Theme['name'], Theme> = {
  'mac-light': macLight,
  'mac-dark': macDark
}

export function getTheme(name: Theme['name']): Theme {
  return themes[name]
}

export type { Theme }
```

`packages/core/src/index.ts` 에 export 추가:
```typescript
export { getTheme, themes } from './theme/index.js'
export type { Theme } from './theme/types.js'
```

- [ ] **Step 2: 빌드 확인**

```bash
pnpm -C packages/core build
```

- [ ] **Step 3: 커밋**

```bash
git add packages/core/src/theme/ packages/core/src/index.ts
git commit -m "feat(core): add Theme type and mac-light/mac-dark presets"
```

### Task 5.2: 폰트 번들

**Files:**
- Create: `packages/core/assets/fonts/Pretendard-Regular.ttf`
- Create: `packages/core/assets/fonts/Pretendard-Bold.ttf`
- Create: `packages/core/assets/fonts/JetBrainsMono-Regular.ttf`
- Create: `packages/core/assets/fonts/LICENSE.md`
- Create: `packages/core/src/theme/fonts.ts`
- Modify: `packages/core/package.json` (assets를 published 파일에 포함)

- [ ] **Step 1: 폰트 파일 다운로드**

```bash
mkdir -p packages/core/assets/fonts
cd packages/core/assets/fonts

# Pretendard
curl -L -o Pretendard-Regular.ttf https://github.com/orioncactus/pretendard/raw/main/packages/pretendard/dist/public/static/Pretendard-Regular.ttf
curl -L -o Pretendard-Bold.ttf    https://github.com/orioncactus/pretendard/raw/main/packages/pretendard/dist/public/static/Pretendard-Bold.ttf

# JetBrains Mono
curl -L -o JetBrainsMono-Regular.ttf https://github.com/JetBrains/JetBrainsMono/raw/master/fonts/ttf/JetBrainsMono-Regular.ttf
```

`packages/core/assets/fonts/LICENSE.md`:
```markdown
# Bundled Fonts

- **Pretendard** — SIL Open Font License 1.1 (https://github.com/orioncactus/pretendard)
- **JetBrains Mono** — SIL Open Font License 1.1 (https://github.com/JetBrains/JetBrainsMono)

전체 라이선스 텍스트는 각 프로젝트 저장소를 참조.
```

- [ ] **Step 2: 폰트 로더**

`packages/core/src/theme/fonts.ts`:
```typescript
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const fontsDir = join(__dirname, '../../assets/fonts')

export type SatoriFont = {
  name: string
  data: Buffer
  weight: 400 | 700
  style: 'normal'
}

let cached: SatoriFont[] | null = null

export function loadFonts(): SatoriFont[] {
  if (cached) return cached
  cached = [
    { name: 'Pretendard', data: readFileSync(join(fontsDir, 'Pretendard-Regular.ttf')), weight: 400, style: 'normal' },
    { name: 'Pretendard', data: readFileSync(join(fontsDir, 'Pretendard-Bold.ttf')),    weight: 700, style: 'normal' },
    { name: 'JetBrains Mono', data: readFileSync(join(fontsDir, 'JetBrainsMono-Regular.ttf')), weight: 400, style: 'normal' }
  ]
  return cached
}
```

`packages/core/package.json` 에 `files` 필드 추가:
```json
{
  "files": ["dist", "assets/fonts"]
}
```

- [ ] **Step 3: 빌드 및 폰트 로드 검증**

```bash
pnpm -C packages/core build
node -e "import('./packages/core/dist/theme/fonts.js').then(m => console.log('loaded', m.loadFonts().length, 'fonts'))"
```

Expected: `loaded 3 fonts`

- [ ] **Step 4: 커밋**

```bash
git add packages/core/assets/ packages/core/src/theme/fonts.ts packages/core/package.json
git commit -m "feat(core): bundle Pretendard and JetBrains Mono fonts"
```

---

## Phase 6 — Core: Render Pipeline

### Task 6.1: Markdown → AST

**Files:**
- Create: `packages/core/src/render/markdown.ts`
- Create: `packages/core/test/render/markdown.test.ts`

- [ ] **Step 1: 실패하는 테스트**

`packages/core/test/render/markdown.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { parseMarkdown } from '../../src/render/markdown.js'

describe('parseMarkdown', () => {
  it('produces an AST with root and paragraph', () => {
    const ast = parseMarkdown('Hello **world**')
    expect(ast.type).toBe('root')
    expect(ast.children[0].type).toBe('paragraph')
  })

  it('handles GFM tables', () => {
    const ast = parseMarkdown('| a | b |\n|---|---|\n| 1 | 2 |')
    const table = ast.children.find((c: any) => c.type === 'table')
    expect(table).toBeDefined()
  })

  it('handles fenced code blocks', () => {
    const ast = parseMarkdown('```ts\nconst x = 1\n```')
    const code = ast.children.find((c: any) => c.type === 'code')
    expect((code as any).lang).toBe('ts')
  })
})
```

- [ ] **Step 2: 실패 확인**

```bash
pnpm -C packages/core test -- markdown
```

- [ ] **Step 3: 구현**

`packages/core/src/render/markdown.ts`:
```typescript
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import type { Root } from 'mdast'

const processor = unified().use(remarkParse).use(remarkGfm)

export function parseMarkdown(md: string): Root {
  return processor.parse(md) as Root
}
```

devDependency 추가:
```bash
pnpm -C packages/core add -D @types/mdast
```

- [ ] **Step 4: 통과 확인 + 커밋**

```bash
pnpm -C packages/core test -- markdown
git add packages/core/src/render/markdown.ts packages/core/test/render/markdown.test.ts packages/core/package.json
git commit -m "feat(core/render): parse markdown to mdast with GFM"
```

### Task 6.2: Shiki 코드 하이라이트

**Files:**
- Create: `packages/core/src/render/highlight.ts`
- Create: `packages/core/test/render/highlight.test.ts`

- [ ] **Step 1: 실패하는 테스트**

`packages/core/test/render/highlight.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { highlightCode } from '../../src/render/highlight.js'

describe('highlightCode', () => {
  it('returns token list with color for typescript', async () => {
    const tokens = await highlightCode('const x = 1', 'ts', 'github-light')
    expect(tokens.length).toBeGreaterThan(0)
    expect(tokens[0].content).toContain('const')
    expect(tokens[0].color).toMatch(/^#/)
  })

  it('returns plain tokens for unknown language', async () => {
    const tokens = await highlightCode('hello', 'unknown-lang', 'github-light')
    expect(tokens.length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: 실패 확인**

```bash
pnpm -C packages/core test -- highlight
```

- [ ] **Step 3: 구현**

`packages/core/src/render/highlight.ts`:
```typescript
import { createHighlighter, type Highlighter } from 'shiki'

export type CodeToken = { content: string; color?: string }

let highlighter: Highlighter | null = null

async function getHl(): Promise<Highlighter> {
  if (highlighter) return highlighter
  highlighter = await createHighlighter({
    themes: ['github-light', 'github-dark'],
    langs: ['typescript', 'javascript', 'json', 'python', 'bash', 'css', 'html', 'markdown', 'go', 'rust', 'yaml']
  })
  return highlighter
}

export async function highlightCode(code: string, lang: string, theme: 'github-light' | 'github-dark'): Promise<CodeToken[][]> {
  const hl = await getHl()
  const known = hl.getLoadedLanguages().includes(lang as never) ? lang : 'text'
  const result = hl.codeToTokens(code, { lang: known as never, theme })
  return result.tokens.map(line => line.map(t => ({ content: t.content, color: t.color })))
}
```

(반환 타입은 line 단위 배열이 들어오므로 `Promise<CodeToken[][]>` 가 자연스럽다. 테스트의 `tokens[0]` 접근은 line[0]이므로 line의 첫 토큰을 의도. 테스트와 시그니처가 맞는지 확인하고 필요 시 테스트를 라인 단위로 조정한다.)

테스트 수정 (라인 단위 검증):
```typescript
it('returns token list with color for typescript', async () => {
  const lines = await highlightCode('const x = 1', 'ts', 'github-light')
  expect(lines.length).toBeGreaterThan(0)
  expect(lines[0][0].content).toContain('const')
  expect(lines[0][0].color).toMatch(/^#/)
})
```

(`unknown-lang` 테스트도 `lines`로)

- [ ] **Step 4: 통과 확인 + 커밋**

```bash
pnpm -C packages/core test -- highlight
git add packages/core/src/render/highlight.ts packages/core/test/render/highlight.test.ts
git commit -m "feat(core/render): integrate Shiki for code block highlighting"
```

### Task 6.3: AST → Satori JSX 트리

**Files:**
- Create: `packages/core/src/render/jsx.ts`
- Create: `packages/core/test/render/jsx.test.ts`

- [ ] **Step 1: 실패하는 테스트**

`packages/core/test/render/jsx.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { mdastToSatori } from '../../src/render/jsx.js'
import { parseMarkdown } from '../../src/render/markdown.js'
import { macLight } from '../../src/theme/mac-light.js'

describe('mdastToSatori', () => {
  it('converts paragraph to a Satori-compatible node', async () => {
    const ast = parseMarkdown('Hello world')
    const node = await mdastToSatori(ast, macLight)
    expect(node).toBeTruthy()
    expect(node.type).toBe('div')
  })

  it('converts code block (with shiki tokens)', async () => {
    const ast = parseMarkdown('```ts\nconst x = 1\n```')
    const node = await mdastToSatori(ast, macLight)
    // 트리 안 어딘가에 monospace 스타일이 있어야 함
    expect(JSON.stringify(node)).toMatch(/JetBrains Mono/)
  })
})
```

- [ ] **Step 2: 실패 확인**

```bash
pnpm -C packages/core test -- jsx
```

- [ ] **Step 3: 구현**

`packages/core/src/render/jsx.ts`:
```typescript
import type { Root, Content, RootContent } from 'mdast'
import type { Theme } from '../theme/types.js'
import { highlightCode } from './highlight.js'

export type SatoriNode = {
  type: string
  props: { style?: Record<string, unknown>; children?: SatoriNode[] | string | (SatoriNode | string)[] }
}

const div = (style: Record<string, unknown>, children: any): SatoriNode =>
  ({ type: 'div', props: { style: { display: 'flex', ...style }, children } })
const span = (style: Record<string, unknown>, children: any): SatoriNode =>
  ({ type: 'span', props: { style, children } })

export async function mdastToSatori(root: Root, theme: Theme): Promise<SatoriNode> {
  const children: any[] = []
  for (const node of root.children) {
    const rendered = await renderBlock(node, theme)
    if (rendered) children.push(rendered)
  }
  return div({ flexDirection: 'column', gap: '12px', color: theme.textPrimary, fontFamily: theme.font.sans }, children)
}

async function renderBlock(node: RootContent, theme: Theme): Promise<SatoriNode | null> {
  switch (node.type) {
    case 'paragraph':
      return div({ flexWrap: 'wrap', fontSize: '14px', lineHeight: 1.6 },
        node.children.map(c => renderInline(c, theme)))
    case 'heading':
      return div({ fontSize: node.depth === 1 ? '20px' : '16px', fontWeight: 700, marginTop: '8px' },
        node.children.map(c => renderInline(c, theme)))
    case 'code': {
      const lines = await highlightCode(node.value, node.lang ?? 'text', theme.codeTheme)
      return div({
        flexDirection: 'column',
        fontFamily: theme.font.mono,
        fontSize: '12px',
        background: theme.codeTheme === 'github-dark' ? '#0d1117' : '#f6f8fa',
        padding: '12px',
        borderRadius: '8px',
        overflow: 'hidden'
      }, lines.map(line => div({}, line.map(t => span({ color: t.color }, t.content)))))
    }
    case 'list': {
      return div({ flexDirection: 'column', gap: '4px', paddingLeft: '16px' },
        node.children.map((li, i) => div({},
          [span({ marginRight: '6px' }, node.ordered ? `${i + 1}.` : '•'),
           div({ flex: 1 }, li.children.flatMap((c: any) => c.children ? c.children.map((x: any) => renderInline(x, theme)) : []))])))
    }
    case 'table': {
      return div({ flexDirection: 'column', border: `1px solid ${theme.windowBorder}`, borderRadius: '6px' },
        node.children.map((row, ri) => div({
          borderBottom: ri < node.children.length - 1 ? `1px solid ${theme.windowBorder}` : 'none'
        }, (row as any).children.map((cell: any) => div({ padding: '6px 10px', flex: 1, fontSize: '13px' },
          cell.children.map((c: any) => renderInline(c, theme)))))))
    }
    default:
      return null
  }
}

function renderInline(node: Content, theme: Theme): SatoriNode | string {
  switch (node.type) {
    case 'text':       return node.value
    case 'strong':     return span({ fontWeight: 700 }, (node.children ?? []).map(c => renderInline(c, theme)))
    case 'emphasis':   return span({ fontStyle: 'italic' }, (node.children ?? []).map(c => renderInline(c, theme)))
    case 'inlineCode': return span({
      fontFamily: theme.font.mono,
      background: theme.codeTheme === 'github-dark' ? '#161b22' : '#f0f0f3',
      padding: '1px 4px',
      borderRadius: '4px',
      fontSize: '12px'
    }, node.value)
    case 'link':       return span({ color: '#0969da' }, (node.children ?? []).map(c => renderInline(c, theme)))
    default:           return ''
  }
}
```

- [ ] **Step 4: 통과 확인 + 커밋**

```bash
pnpm -C packages/core test -- jsx
git add packages/core/src/render/jsx.ts packages/core/test/render/jsx.test.ts
git commit -m "feat(core/render): convert mdast to Satori-compatible JSX tree"
```

### Task 6.4: 전체 렌더 파이프라인 (renderExchange)

**Files:**
- Create: `packages/core/src/render/index.ts`
- Create: `packages/core/test/render/index.test.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: 실패하는 테스트**

`packages/core/test/render/index.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { renderExchange } from '../../src/render/index.js'
import { macLight } from '../../src/theme/mac-light.js'
import type { Exchange } from '../../src/types.js'

const sample: Exchange = {
  source: 'codex',
  sourceLabel: 'Codex',
  sessionId: 'test',
  sessionPath: '/tmp/test.jsonl',
  timestamp: new Date(),
  user: { content: '안녕! 코드 예시 좀.' },
  assistant: { content: '```ts\nconst x = 1\n```\n\n**Bold** and `inline`.' }
}

describe('renderExchange', () => {
  it('produces a valid PNG buffer', async () => {
    const png = await renderExchange(sample, macLight, { width: 720 })
    expect(Buffer.isBuffer(png)).toBe(true)
    // PNG magic bytes: 89 50 4E 47
    expect(png.subarray(0, 4).toString('hex')).toBe('89504e47')
    expect(png.length).toBeGreaterThan(1000)
  }, 30000)
})
```

- [ ] **Step 2: 실패 확인**

```bash
pnpm -C packages/core test -- render/index
```

- [ ] **Step 3: 구현**

`packages/core/src/render/index.ts`:
```typescript
import satori from 'satori'
import { Resvg } from '@resvg/resvg-js'
import type { Exchange } from '../types.js'
import type { Theme } from '../theme/types.js'
import { loadFonts } from '../theme/fonts.js'
import { parseMarkdown } from './markdown.js'
import { mdastToSatori, type SatoriNode } from './jsx.js'

export type RenderOptions = { width?: number; maxHeight?: number }

export async function renderExchange(ex: Exchange, theme: Theme, opts: RenderOptions = {}): Promise<Buffer> {
  const width = opts.width ?? 720
  const userBody = await mdastToSatori(parseMarkdown(ex.user.content), theme)
  const aiBody = await mdastToSatori(parseMarkdown(ex.assistant.content), theme)

  const tree: SatoriNode = {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        width: `${width}px`,
        background: theme.outerBackground,
        padding: `${theme.outerPadding}px`,
        fontFamily: theme.font.sans
      },
      children: [
        // window
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              flexDirection: 'column',
              background: theme.windowBackground,
              borderRadius: `${theme.cornerRadius}px`,
              boxShadow: `0 10px 30px ${theme.shadowColor}`,
              overflow: 'hidden',
              border: `1px solid ${theme.windowBorder}`
            },
            children: [
              // chrome
              {
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    alignItems: 'center',
                    padding: '10px 14px',
                    gap: '6px',
                    background: theme.chromeBackground,
                    borderBottom: `1px solid ${theme.windowBorder}`
                  },
                  children: [
                    ...theme.trafficLightColors.map(c => ({
                      type: 'div',
                      props: { style: { width: '12px', height: '12px', borderRadius: '50%', background: c } }
                    } as SatoriNode)),
                    {
                      type: 'div',
                      props: {
                        style: { flex: 1, textAlign: 'center', color: theme.textSecondary, fontSize: '12px' },
                        children: `${ex.sourceLabel} · ${formatRel(ex.timestamp)}`
                      }
                    }
                  ]
                }
              },
              // body
              {
                type: 'div',
                props: {
                  style: { display: 'flex', flexDirection: 'column', padding: '20px', gap: '16px' },
                  children: [
                    sectionLabel('You', theme),
                    userBody,
                    { type: 'div', props: { style: { height: '1px', background: theme.windowBorder, margin: '4px 0' } } },
                    sectionLabel(ex.sourceLabel, theme),
                    aiBody
                  ]
                }
              }
            ]
          }
        }
      ]
    }
  }

  const svg = await satori(tree as never, { width: width + theme.outerPadding * 2, fonts: loadFonts() as never })
  const png = new Resvg(svg).render().asPng()
  return Buffer.from(png)
}

function sectionLabel(text: string, theme: Theme): SatoriNode {
  return { type: 'div', props: { style: { fontSize: '11px', fontWeight: 700, color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: '0.5px' }, children: text } }
}

function formatRel(d: Date): string {
  const s = Math.floor((Date.now() - d.getTime()) / 1000)
  if (s < 60) return `${s}초 전`
  if (s < 3600) return `${Math.floor(s / 60)}분 전`
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`
  return `${Math.floor(s / 86400)}일 전`
}
```

`packages/core/src/index.ts` 에 export 추가:
```typescript
export { renderExchange } from './render/index.js'
export type { RenderOptions } from './render/index.js'
```

- [ ] **Step 4: 통과 확인**

```bash
pnpm -C packages/core test -- render/index
```

산출 PNG를 눈으로 확인하려면 임시로 `writeFileSync('out.png', png)` 추가 후 열어 본다.

- [ ] **Step 5: 커밋**

```bash
git add packages/core/src/render/ packages/core/src/index.ts packages/core/test/render/
git commit -m "feat(core/render): assemble macOS-style window with chrome and body"
```

---

## Phase 7 — Core: Output

### Task 7.1: 파일 저장 (충돌 처리)

**Files:**
- Create: `packages/core/src/output/index.ts`
- Create: `packages/core/test/output.test.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: 실패하는 테스트**

`packages/core/test/output.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { mkdtempSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { saveImageToFile } from '../src/output/index.js'

describe('saveImageToFile', () => {
  let dir: string
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'promptshot-'))
  })

  it('saves PNG to given directory with timestamp-based name', async () => {
    const buf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    const path = await saveImageToFile(buf, dir)
    expect(existsSync(path)).toBe(true)
    expect(path).toMatch(/\.png$/)
    rmSync(dir, { recursive: true, force: true })
  })

  it('suffixes _2, _3 on collision', async () => {
    const buf = Buffer.from([0x89, 0x50, 0x4e, 0x47])
    const p1 = await saveImageToFile(buf, dir, { now: new Date(2026, 4, 13, 14, 30, 0) })
    const p2 = await saveImageToFile(buf, dir, { now: new Date(2026, 4, 13, 14, 30, 0) })
    expect(p1).not.toBe(p2)
    expect(p2).toMatch(/_2\.png$/)
    rmSync(dir, { recursive: true, force: true })
  })
})
```

- [ ] **Step 2: 실패 확인**

```bash
pnpm -C packages/core test -- output
```

- [ ] **Step 3: 구현**

`packages/core/src/output/index.ts`:
```typescript
import { writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

export async function saveImageToFile(buffer: Buffer, dir: string, opts?: { now?: Date }): Promise<string> {
  await mkdir(dir, { recursive: true })
  const now = opts?.now ?? new Date()
  const base = stamp(now)
  let path = join(dir, `${base}.png`)
  let i = 2
  while (existsSync(path)) {
    path = join(dir, `${base}_${i}.png`)
    i++
  }
  await writeFile(path, buffer)
  return path
}

function stamp(d: Date): string {
  const p = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`
}
```

`packages/core/src/index.ts`:
```typescript
export { saveImageToFile } from './output/index.js'
```

- [ ] **Step 4: 통과 확인 + 커밋**

```bash
pnpm -C packages/core test -- output
git add packages/core/src/output/ packages/core/src/index.ts packages/core/test/output.test.ts
git commit -m "feat(core/output): save PNG with timestamp name and collision suffix"
```

---

## Phase 8 — VS Code Extension

### Task 8.1: 확장 진입점 + Capture Last Exchange 명령

**Files:**
- Modify: `packages/vscode-ext/src/extension.ts`
- Create: `packages/vscode-ext/src/commands/captureImage.ts`
- Create: `packages/vscode-ext/src/config.ts`

- [ ] **Step 1: 설정 헬퍼**

`packages/vscode-ext/src/config.ts`:
```typescript
import * as vscode from 'vscode'
import { homedir } from 'node:os'
import { join } from 'node:path'

export function getConfig() {
  const c = vscode.workspace.getConfiguration('promptshot')
  return {
    theme: c.get<'mac-light' | 'mac-dark'>('theme', 'mac-light'),
    source: c.get<'auto' | 'codex' | 'claude-code'>('source', 'auto'),
    outputDir: c.get<string>('outputDir', '') || join(homedir(), 'Pictures', 'Promptshot'),
    width: c.get<number>('width', 720),
    maxHeight: c.get<number>('maxHeight', 4000),
    includeTools: c.get<boolean>('includeTools', false),
    includeSystem: c.get<boolean>('includeSystem', false)
  }
}
```

- [ ] **Step 2: Capture Image 명령**

`packages/vscode-ext/src/commands/captureImage.ts`:
```typescript
import * as vscode from 'vscode'
import { selectLatestExchange, renderExchange, getTheme, saveImageToFile, redactSecrets } from '@promptshot/core'
import { getConfig } from '../config.js'
import { copyImageToClipboard } from '../clipboard/image.js'

let lastCapturePath: string | null = null
export function getLastCapturePath(): string | null { return lastCapturePath }

export async function captureImageCommand(context: vscode.ExtensionContext): Promise<void> {
  const cfg = getConfig()
  const ws = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath

  try {
    const ex = await selectLatestExchange({ source: cfg.source, workspaceHint: ws })
    if (!ex) {
      vscode.window.showWarningMessage('Promptshot: 마지막 user→assistant 쌍을 찾지 못했습니다.')
      return
    }

    // 마스킹
    const user = redactSecrets(ex.user.content)
    const ai = redactSecrets(ex.assistant.content)
    const redactedHits = [...user.hits, ...ai.hits]
    const exForRender = { ...ex, user: { content: user.text }, assistant: { ...ex.assistant, content: ai.text } }

    const png = await renderExchange(exForRender, getTheme(cfg.theme), { width: cfg.width, maxHeight: cfg.maxHeight })
    const filePath = await saveImageToFile(png, cfg.outputDir)
    lastCapturePath = filePath
    await copyImageToClipboard(context, png)

    const summary = `Captured · ${ex.sourceLabel}` + (redactedHits.length ? ` · Redacted: ${redactedHits.join(', ')}` : '')
    const action = await vscode.window.showInformationMessage(summary, 'Open File', 'Reveal in Folder')
    if (action === 'Open File') await vscode.env.openExternal(vscode.Uri.file(filePath))
    if (action === 'Reveal in Folder') await vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(filePath))
  } catch (e: any) {
    vscode.window.showErrorMessage(`Promptshot: ${e.message ?? String(e)}`)
  }
}
```

- [ ] **Step 3: 진입점 수정**

`packages/vscode-ext/src/extension.ts`:
```typescript
import * as vscode from 'vscode'
import { captureImageCommand } from './commands/captureImage.js'

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('promptshot.captureLastExchange', () => captureImageCommand(context))
  )
}

export function deactivate(): void {}
```

- [ ] **Step 4: 빌드 검증**

```bash
pnpm -r build
```

Expected: 에러 없음.

- [ ] **Step 5: 커밋 (clipboard 모듈은 다음 태스크에서 생성 예정이라 빌드 깨질 수 있음 → 다음 태스크와 묶어 커밋)**

다음 Task 8.2 이후 함께 커밋한다.

### Task 8.2: Hidden Webview 이미지 클립보드

**Files:**
- Create: `packages/vscode-ext/src/clipboard/image.ts`
- Create: `packages/vscode-ext/src/clipboard/webview.html`

- [ ] **Step 1: Webview HTML**

`packages/vscode-ext/src/clipboard/webview.html`:
```html
<!doctype html>
<html><body>
<script>
  const vscode = acquireVsCodeApi()
  vscode.postMessage({ type: 'ready' })
  window.addEventListener('message', async (ev) => {
    if (ev.data.type !== 'png') return
    try {
      const res = await fetch('data:image/png;base64,' + ev.data.data)
      const blob = await res.blob()
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      vscode.postMessage({ type: 'done', ok: true })
    } catch (e) {
      vscode.postMessage({ type: 'done', ok: false, error: String(e) })
    }
  })
</script>
</body></html>
```

- [ ] **Step 2: 클립보드 헬퍼**

`packages/vscode-ext/src/clipboard/image.ts`:
```typescript
import * as vscode from 'vscode'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export async function copyImageToClipboard(context: vscode.ExtensionContext, png: Buffer): Promise<boolean> {
  return new Promise(resolve => {
    const panel = vscode.window.createWebviewPanel(
      'promptshotClipboard', 'Promptshot', { viewColumn: vscode.ViewColumn.Active, preserveFocus: false },
      { enableScripts: true, retainContextWhenHidden: false }
    )
    const html = readFileSync(join(context.extensionPath, 'dist', 'clipboard', 'webview.html'), 'utf8')
    panel.webview.html = html

    const timeout = setTimeout(() => { panel.dispose(); resolve(false) }, 5000)

    panel.webview.onDidReceiveMessage(msg => {
      if (msg.type === 'ready') {
        panel.webview.postMessage({ type: 'png', data: png.toString('base64') })
      }
      if (msg.type === 'done') {
        clearTimeout(timeout)
        panel.dispose()
        resolve(!!msg.ok)
      }
    })
  })
}
```

- [ ] **Step 3: 빌드 시 webview.html을 dist로 복사**

`packages/vscode-ext/package.json` 의 `scripts.build` 수정:
```json
"build": "tsc && node ../../scripts/copy-assets.mjs"
```

`scripts/copy-assets.mjs` (워크스페이스 루트에 생성):
```javascript
import { mkdirSync, copyFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
const src = 'packages/vscode-ext/src/clipboard/webview.html'
const dst = 'packages/vscode-ext/dist/clipboard/webview.html'
mkdirSync(dirname(dst), { recursive: true })
copyFileSync(src, dst)
console.log('copied', dst)
```

- [ ] **Step 4: 빌드 및 수동 확인**

```bash
pnpm -r build
```

VS Code에서 `packages/vscode-ext` 폴더 열고 F5 → Extension Development Host → `Ctrl+Alt+P` 또는 Command Palette → `Promptshot: Capture Last Exchange` → 알림 + 그림판에 `Ctrl+V` 동작 확인.

- [ ] **Step 5: 커밋**

```bash
git add packages/vscode-ext/src/ scripts/copy-assets.mjs packages/vscode-ext/package.json
git commit -m "feat(vscode-ext): implement captureLastExchange with hidden-webview clipboard"
```

### Task 8.3: Capture as Markdown 명령

**Files:**
- Create: `packages/vscode-ext/src/commands/captureMarkdown.ts`
- Modify: `packages/vscode-ext/src/extension.ts`

- [ ] **Step 1: 마크다운 명령**

`packages/vscode-ext/src/commands/captureMarkdown.ts`:
```typescript
import * as vscode from 'vscode'
import { selectLatestExchange, redactSecrets } from '@promptshot/core'
import { getConfig } from '../config.js'

export async function captureMarkdownCommand(): Promise<void> {
  const cfg = getConfig()
  const ws = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath

  try {
    const ex = await selectLatestExchange({ source: cfg.source, workspaceHint: ws })
    if (!ex) return void vscode.window.showWarningMessage('Promptshot: no exchange to capture')
    const user = redactSecrets(ex.user.content)
    const ai = redactSecrets(ex.assistant.content)

    const md = [
      `**${ex.sourceLabel}** — ${ex.timestamp.toLocaleString()}`,
      ``,
      `### You`,
      user.text,
      ``,
      `### ${ex.sourceLabel}`,
      ai.text
    ].join('\n')

    await vscode.env.clipboard.writeText(md)
    const hits = [...user.hits, ...ai.hits]
    vscode.window.showInformationMessage('Markdown copied' + (hits.length ? ` · Redacted: ${hits.join(', ')}` : ''))
  } catch (e: any) {
    vscode.window.showErrorMessage(`Promptshot: ${e.message ?? String(e)}`)
  }
}
```

- [ ] **Step 2: 등록**

`packages/vscode-ext/src/extension.ts`:
```typescript
import * as vscode from 'vscode'
import { captureImageCommand } from './commands/captureImage.js'
import { captureMarkdownCommand } from './commands/captureMarkdown.js'

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('promptshot.captureLastExchange', () => captureImageCommand(context)),
    vscode.commands.registerCommand('promptshot.captureAsMarkdown', () => captureMarkdownCommand())
  )
}

export function deactivate(): void {}
```

- [ ] **Step 3: 빌드 + 수동 확인 + 커밋**

```bash
pnpm -r build
```

Extension Development Host → `Promptshot: Capture as Markdown` → 다른 곳에 붙여넣기 확인.

```bash
git add packages/vscode-ext/src/commands/captureMarkdown.ts packages/vscode-ext/src/extension.ts
git commit -m "feat(vscode-ext): add captureAsMarkdown command"
```

### Task 8.4: Pick Session / Choose Theme / Open Last Capture

**Files:**
- Create: `packages/vscode-ext/src/commands/pickSession.ts`
- Create: `packages/vscode-ext/src/commands/chooseTheme.ts`
- Create: `packages/vscode-ext/src/commands/openLast.ts`
- Modify: `packages/vscode-ext/src/extension.ts`

- [ ] **Step 1: Pick Session**

`packages/vscode-ext/src/commands/pickSession.ts`:
```typescript
import * as vscode from 'vscode'
import { CodexSource, ClaudeCodeSource } from '@promptshot/core'

export async function pickSessionCommand(): Promise<void> {
  const codex = new CodexSource()
  const claude = new ClaudeCodeSource()
  const [c1, c2] = await Promise.all([codex.discoverSessions(), claude.discoverSessions()])
  const items: vscode.QuickPickItem[] = [
    ...c1.slice(0, 10).map(f => ({ label: `$(squirrel) Codex · ${f.mtime.toLocaleString()}`, description: f.path })),
    ...c2.slice(0, 10).map(f => ({ label: `$(robot) Claude Code · ${f.mtime.toLocaleString()}`, description: f.path }))
  ]
  if (items.length === 0) return void vscode.window.showWarningMessage('Promptshot: no sessions found')
  const pick = await vscode.window.showQuickPick(items, { placeHolder: '캡쳐할 세션을 선택하세요' })
  if (!pick) return
  await vscode.commands.executeCommand('promptshot.captureLastExchange', { sessionPath: pick.description })
}
```

(현재 captureImageCommand는 sessionPath 인자를 받지 않으므로, 인자 처리는 v1.1 후보 — 이번에는 단순히 가장 최근만 캡쳐. 구현 시 captureImageCommand에 옵셔널 인자 추가)

`packages/vscode-ext/src/commands/captureImage.ts` 인자 추가:
```typescript
export async function captureImageCommand(context: vscode.ExtensionContext, arg?: { sessionPath?: string }): Promise<void> {
  // ... 기존 코드, selectLatestExchange 옵션에 arg.sessionPath 전달
}
```

(`selectLatestExchange`에 `sessionPath` 옵션 추가 필요 → core selector 보강)

- [ ] **Step 2: Choose Theme**

`packages/vscode-ext/src/commands/chooseTheme.ts`:
```typescript
import * as vscode from 'vscode'

export async function chooseThemeCommand(): Promise<void> {
  const pick = await vscode.window.showQuickPick(
    [{ label: 'mac-light' }, { label: 'mac-dark' }],
    { placeHolder: '테마 선택' }
  )
  if (!pick) return
  await vscode.workspace.getConfiguration('promptshot').update('theme', pick.label, vscode.ConfigurationTarget.Global)
  vscode.window.showInformationMessage(`Promptshot theme: ${pick.label}`)
}
```

- [ ] **Step 3: Open Last Capture**

`packages/vscode-ext/src/commands/openLast.ts`:
```typescript
import * as vscode from 'vscode'
import { getLastCapturePath } from './captureImage.js'

export async function openLastCaptureCommand(): Promise<void> {
  const p = getLastCapturePath()
  if (!p) return void vscode.window.showInformationMessage('Promptshot: 캡쳐 기록이 없습니다')
  await vscode.env.openExternal(vscode.Uri.file(p))
}
```

- [ ] **Step 4: 등록**

`packages/vscode-ext/src/extension.ts` 에 3개 명령 등록 추가.

- [ ] **Step 5: 빌드 + 수동 확인 + 커밋**

```bash
pnpm -r build
git add packages/vscode-ext/src/
git commit -m "feat(vscode-ext): add pickSession / chooseTheme / openLastCapture commands"
```

### Task 8.5: 통합 테스트 (`@vscode/test-electron`)

**Files:**
- Create: `packages/vscode-ext/test/runTest.ts`
- Create: `packages/vscode-ext/test/suite/index.ts`
- Create: `packages/vscode-ext/test/suite/extension.test.ts`
- Modify: `packages/vscode-ext/package.json` (`scripts.test`)

- [ ] **Step 1: 테스트 러너 셋업**

`packages/vscode-ext/test/runTest.ts`:
```typescript
import { runTests } from '@vscode/test-electron'
import { resolve } from 'node:path'

async function main() {
  const extensionDevelopmentPath = resolve(__dirname, '..')
  const extensionTestsPath = resolve(__dirname, './suite/index.js')
  await runTests({ extensionDevelopmentPath, extensionTestsPath })
}

main().catch(err => { console.error(err); process.exit(1) })
```

`packages/vscode-ext/test/suite/index.ts`:
```typescript
import { glob } from 'glob'
import Mocha from 'mocha'
import { resolve } from 'node:path'

export async function run(): Promise<void> {
  const mocha = new Mocha({ ui: 'tdd', color: true })
  const testsRoot = resolve(__dirname)
  const files = await glob('**/**.test.js', { cwd: testsRoot })
  files.forEach(f => mocha.addFile(resolve(testsRoot, f)))
  return new Promise((resolve, reject) => {
    mocha.run(failures => failures > 0 ? reject(new Error(`${failures} tests failed`)) : resolve())
  })
}
```

- [ ] **Step 2: 기본 활성화 테스트**

`packages/vscode-ext/test/suite/extension.test.ts`:
```typescript
import * as assert from 'node:assert'
import * as vscode from 'vscode'

suite('Promptshot Extension', () => {
  test('commands are registered', async () => {
    const all = await vscode.commands.getCommands(true)
    assert.ok(all.includes('promptshot.captureLastExchange'))
    assert.ok(all.includes('promptshot.captureAsMarkdown'))
    assert.ok(all.includes('promptshot.pickSession'))
    assert.ok(all.includes('promptshot.chooseTheme'))
    assert.ok(all.includes('promptshot.openLastCapture'))
  })
})
```

- [ ] **Step 3: scripts.test 수정**

`packages/vscode-ext/package.json`:
```json
"test": "tsc -p . && node ./test/runTest.js"
```

devDependencies에 `mocha`, `glob`, `@types/mocha` 추가:
```bash
pnpm -C packages/vscode-ext add -D mocha @types/mocha glob @types/glob
```

- [ ] **Step 4: 테스트 실행**

```bash
pnpm -C packages/vscode-ext test
```

Expected: 통과. CI에서는 xvfb (Linux)가 필요하므로 ubuntu-latest 잡에 `xvfb-run` wrapper 적용 — `.github/workflows/ci.yml` 에 분기 추가.

- [ ] **Step 5: 커밋**

```bash
git add packages/vscode-ext/test/ packages/vscode-ext/package.json .github/workflows/ci.yml
git commit -m "test(vscode-ext): wire @vscode/test-electron with command registration check"
```

---

## Phase 9 — Docs & Samples

### Task 9.1: README + 사용법

**Files:**
- Modify: `README.md` (workspace root)
- Modify: `packages/vscode-ext/README.md` (Marketplace용)

- [ ] **Step 1: 워크스페이스 README 풍부화**

`README.md`:
```markdown
# Promptshot

Capture VS Code's secondary-sidebar AI chat (Codex / Claude Code) into beautiful
PNG images or clean markdown for sharing.

![sample](docs/samples/mac-light-short.png)

## Features
- Captures last user → assistant exchange (single bubble pair)
- macOS-styled window chrome with traffic lights
- Sources: Codex (~/.codex/sessions) and Claude Code (~/.claude/projects)
- Cross-platform (Windows / macOS / Linux)
- Image clipboard (paste into Slack/email) + file save
- Markdown clipboard mode (for wikis / GitHub)
- Auto-redacts common API keys / tokens

## Usage
1. Install from VS Code Marketplace
2. Use Codex or Claude Code in VS Code as usual
3. Press `Ctrl+Alt+P` (Mac: `Cmd+Alt+P`) → image goes to clipboard
4. Paste into Slack/email

See [design spec](docs/superpowers/specs/2026-05-13-promptshot-design.md) and
[decisions log](docs/DECISIONS.md) for details.
```

- [ ] **Step 2: Marketplace README**

`packages/vscode-ext/README.md`: (Marketplace에 노출되는 페이지) — 스크린샷 3장 이상 + 키바인딩 표 + 설정 표.

- [ ] **Step 3: 커밋**

```bash
git add README.md packages/vscode-ext/README.md
git commit -m "docs: write user-facing README"
```

### Task 9.2: 샘플 카탈로그 생성 스크립트

**Files:**
- Create: `scripts/generate-samples.mjs`
- Create: `docs/samples/.gitkeep`

- [ ] **Step 1: 생성 스크립트**

`scripts/generate-samples.mjs`:
```javascript
import { renderExchange, getTheme } from '../packages/core/dist/index.js'
import { writeFileSync, mkdirSync } from 'node:fs'

const samples = {
  short:    { user: '안녕!', assistant: '안녕하세요.' },
  code:     { user: 'TS 한 줄', assistant: '```ts\nconst x = 1\n```' },
  table:    { user: '표 좀', assistant: '| a | b |\n|---|---|\n| 1 | 2 |' },
  longish:  { user: '긴 답변 줘', assistant: '## Heading\n\n- one\n- two\n- three\n\n**Bold** and *italic*.' }
}

mkdirSync('docs/samples', { recursive: true })

for (const themeName of ['mac-light', 'mac-dark']) {
  for (const [name, msgs] of Object.entries(samples)) {
    const ex = {
      source: 'codex', sourceLabel: 'Codex',
      sessionId: 'sample', sessionPath: '/sample',
      timestamp: new Date(),
      user: { content: msgs.user },
      assistant: { content: msgs.assistant }
    }
    const png = await renderExchange(ex, getTheme(themeName), { width: 720 })
    writeFileSync(`docs/samples/${themeName}-${name}.png`, png)
    console.log(`docs/samples/${themeName}-${name}.png`)
  }
}
```

루트 `package.json` scripts:
```json
"samples": "pnpm -C packages/core build && node scripts/generate-samples.mjs"
```

- [ ] **Step 2: 실행 및 카탈로그 추가**

```bash
pnpm samples
git add docs/samples/*.png scripts/generate-samples.mjs package.json
git commit -m "docs: add sample output catalog (8 PNGs across 2 themes)"
```

### Task 9.3: 아이콘

**Files:**
- Create: `packages/vscode-ext/icon.png` (128x128)

- [ ] **Step 1: 디자인 (manual)**

Figma 또는 사용자 선호 도구로 128x128 아이콘 제작. Carbon 스타일에서 영감받은 brand mark (대화 말풍선 + 셔터 같은 모티프). 라이트/다크 둘 다 잘 보이는 색상.

- [ ] **Step 2: 파일 추가 및 manifest 갱신**

```bash
git add packages/vscode-ext/icon.png
```

`packages/vscode-ext/package.json` 에 `"icon": "icon.png"` 추가.

- [ ] **Step 3: 커밋**

```bash
git add packages/vscode-ext/icon.png packages/vscode-ext/package.json
git commit -m "chore(vscode-ext): add marketplace icon"
```

---

## Phase 10 — Marketplace 발행

### Task 10.1: Pre-release 매뉴얼 체크리스트

> 이 태스크는 실제 사람이 수동으로 수행한다. 자동화하지 않는다.

- [ ] 3 OS (Windows / macOS / Linux) Extension Development Host에서 각각 동작 검증
  - Codex 세션 캡쳐 (이미지 + 클립보드)
  - Claude Code 세션 캡쳐 (이미지 + 클립보드)
  - 마크다운 모드 (클립보드)
  - 한글 메시지 렌더 깨짐 없음
  - mac-light / mac-dark 토글
- [ ] 권한 프롬프트 UX 확인 (첫 실행 시)
- [ ] `docs/samples/` 8장 모두 시각 확인
- [ ] README의 모든 스크린샷이 최신
- [ ] LICENSE 파일 존재 (MIT 권장)
- [ ] CHANGELOG.md 초안 (0.1.0 entries)
- [ ] CI 마지막 빌드 통과

체크리스트 통과를 `docs/DECISIONS.md` `#NNN — v0.1.0 release readiness` 항목으로 기록.

### Task 10.2: Publisher 등록 + .vsix 패키징

- [ ] **Step 1: Azure DevOps Personal Access Token 발급**

https://dev.azure.com 에서 Personal Access Token (Marketplace publish scope) 발급. Decisions log에 publisher name과 발급 사실 기록 (token 자체는 절대 커밋 금지).

- [ ] **Step 2: Publisher 생성**

```bash
npx @vscode/vsce login <publisher-name>
```

- [ ] **Step 3: package.json publisher 필드 갱신 및 커밋**

`packages/vscode-ext/package.json` 의 `publisher` 를 `"TBD-set-before-publish"` 에서 실제 publisher ID로 교체.

```bash
git add packages/vscode-ext/package.json
git commit -m "chore(vscode-ext): set publisher ID"
```

- [ ] **Step 4: 패키지 빌드**

```bash
pnpm -r build
pnpm -C packages/vscode-ext package
```

Expected: `packages/vscode-ext/promptshot-0.0.1.vsix` 생성.

- [ ] **Step 5: 로컬 .vsix 설치 테스트**

VS Code → Extensions → ... → Install from VSIX → 위 파일 선택 → 모든 명령 동작 확인.

### Task 10.3: 발행

> 매뉴얼 단계. 신중히.

- [ ] **Step 1: 버전 확정**

`packages/vscode-ext/package.json` 의 `version` 을 `0.1.0` 으로 올림. CHANGELOG.md에 첫 릴리스 노트.

```bash
git add packages/vscode-ext/package.json CHANGELOG.md
git commit -m "release: 0.1.0"
git tag v0.1.0
```

- [ ] **Step 2: 발행**

```bash
pnpm -C packages/vscode-ext exec vsce publish
```

- [ ] **Step 3: 검증**

Marketplace 페이지 (`https://marketplace.visualstudio.com/items?itemName=<publisher>.promptshot`) 가 노출되는지 확인. README, screenshots, icon 모두 잘 보이는지.

```bash
git push --tags
```

- [ ] **Step 4: 릴리스를 DECISIONS.md에 기록**

`#NNN — Initial release (0.1.0)` 항목으로 출시 사실, 버전, 알려진 제약 기록.

---

## Self-Review (계획 자체에 대한 점검)

**Spec coverage**:
- Section 1.2 Goals (8개): VS Code 확장만(Task 1.3), 양 소스 동등(Task 2.3/2.5), 한 키 캡쳐(Task 8.1), Slack 이미지(Task 6.4), 마크다운(Task 8.3), macOS 스타일(Task 5.1/6.4), cross-platform(Task 0.1/1.4), Marketplace(Task 10) — 모두 매핑됨
- Section 3 컴포넌트(8개): sources(Task 2.3/2.5), selector(Task 3.1), theme(Task 5.1/5.2), render(Task 6.1-6.4), redact(Task 4.1), output(Task 7.1), vscode-ext(Task 8.1-8.4) — 모두 매핑됨
- Section 5 에러 처리: 환경/입력은 selector & 명령에서, 파싱은 source 테스트 fixtures(truncated/no-assistant), 렌더는 폰트 fallback(Task 5.2), 출력은 output 충돌 처리(Task 7.1) — 매핑됨
- Section 6 테스트: 단위 테스트 각 모듈, 통합 8.5, 샘플 카탈로그 9.2, CI 1.4 — 매핑됨

**Placeholder scan**: TBD는 publisher ID(Task 10.2에서 처리) 외 없음. "구현 단계에서 검증" 같은 표현은 Task 2.2/2.4의 schema 샘플링 단계에서 실제로 검증하도록 명시.

**Type consistency**: 
- `Exchange` 정의(Task 2.1) → 사용처(Task 2.3, 2.5, 3.1, 6.4, 8.1) 모두 동일 시그니처
- `Theme` 타입 → 사용처 모두 정합
- `SatoriNode` (Task 6.3) → renderExchange에서 사용 (Task 6.4)

**Granularity**: 각 step이 2-5분 단위. 일부 step(예: Task 9.3 아이콘)은 사람 작업이 필요하지만 명시됨.

---

## 끝.

이 계획은 약 25개 태스크로 나뉘며, 각 태스크는 2-5분의 step들로 구성된다. TDD 원칙(테스트 → 실패 → 구현 → 통과 → 커밋)을 핵심 모듈마다 따른다.

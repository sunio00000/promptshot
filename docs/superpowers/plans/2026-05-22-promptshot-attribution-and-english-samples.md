# Promptshot Attribution + English Samples Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PNG·Markdown 출력에 ` · via Promptshot` 어트리뷰션을 추가하고, README 샘플 이미지를 영어로 재생성한 뒤 v0.1.3으로 릴리스 준비한다.

**Architecture:** 두 곳에서 메타 라인 텍스트만 수정한다 — PNG는 `chrome()` 함수(`packages/core/src/render/index.ts`), Markdown은 `captureMarkdownCommand`(`packages/vscode-ext/src/commands/captureMarkdown.ts`). `formatRel`은 영어 약자(`sec/min/hr/day(s) ago`)로 통합 변경하고 `__test__` 네임스페이스로 노출해 단위 테스트. 샘플 콘텐츠는 `scripts/generate-samples.mjs`에서 영어로 교체하고 8개 PNG를 덮어쓴다.

**Tech Stack:** TypeScript 5.4, pnpm 워크스페이스 모노레포, vitest (core 단위 테스트), Mocha + @vscode/test-electron (vscode-ext 통합 테스트), esbuild (확장 번들), satori + @resvg/resvg-wasm (PNG 렌더).

**Spec:** `docs/superpowers/specs/2026-05-22-promptshot-attribution-and-english-samples-design.md`

---

## File Map

| 파일 | 변경 종류 | 책임 |
|---|---|---|
| `packages/core/src/render/index.ts` | Modify | `chrome()` 라벨에 ` · via Promptshot` 추가 · `formatRel` 영어화 + `__test__` export |
| `packages/core/test/render/formatRel.test.ts` | Create | `formatRel` 영어 출력 단위 테스트 |
| `packages/core/src/index.ts` | (점검만) | 신규 public export 없음 — `__test__` 패턴은 모듈 내부에서만 |
| `packages/vscode-ext/src/commands/captureMarkdown.ts` | Modify | Markdown 첫 줄 헤더에 ` · via Promptshot` 추가 |
| `scripts/generate-samples.mjs` | Modify | `samples` 객체를 영어로 교체 |
| `docs/samples/*.png` (8개) | Regenerate | `node scripts/generate-samples.mjs`로 덮어쓰기 |
| `CHANGELOG.md` | Modify | `## [0.1.3] — 2026-05-22` 섹션 최상단 추가 |
| `packages/vscode-ext/package.json` | Modify | `version`: `0.1.2` → `0.1.3` |

---

## Task 1: `formatRel` 영어 출력 — Test (RED)

**Files:**
- Create: `packages/core/test/render/formatRel.test.ts`
- Modify: `packages/core/src/render/index.ts:48` (이 태스크에서는 export만 먼저 추가)

- [ ] **Step 1: `formatRel`을 `__test__` 네임스페이스에 노출**

`packages/core/src/render/index.ts:48` 한 줄을 다음과 같이 수정:

```diff
- export const __test__ = { applyMaxHeight }
+ export const __test__ = { applyMaxHeight, formatRel }
```

(이 시점에 `formatRel`은 아직 한국어 출력. 다음 태스크에서 영어로 변경)

- [ ] **Step 2: 실패하는 테스트 작성**

`packages/core/test/render/formatRel.test.ts` 신규 생성:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { __test__ } from '../../src/render/index.js'

const { formatRel } = __test__

describe('formatRel', () => {
  const NOW = new Date('2026-05-22T14:30:00Z').getTime()

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  function ago(ms: number): Date {
    return new Date(NOW - ms)
  }

  it('renders seconds with "sec ago"', () => {
    expect(formatRel(ago(5_000))).toBe('5 sec ago')
    expect(formatRel(ago(0))).toBe('0 sec ago')
  })

  it('renders minutes with "min ago"', () => {
    expect(formatRel(ago(60_000))).toBe('1 min ago')
    expect(formatRel(ago(5 * 60_000))).toBe('5 min ago')
    expect(formatRel(ago(59 * 60_000))).toBe('59 min ago')
  })

  it('renders hours with "hr ago"', () => {
    expect(formatRel(ago(60 * 60_000))).toBe('1 hr ago')
    expect(formatRel(ago(3 * 60 * 60_000))).toBe('3 hr ago')
  })

  it('uses singular "day" for exactly 1 day, "days" otherwise', () => {
    const day = 24 * 60 * 60_000
    expect(formatRel(ago(day))).toBe('1 day ago')
    expect(formatRel(ago(2 * day))).toBe('2 days ago')
    expect(formatRel(ago(30 * day))).toBe('30 days ago')
  })

  it('does not produce Korean output', () => {
    const samples = [
      formatRel(ago(5_000)),
      formatRel(ago(5 * 60_000)),
      formatRel(ago(3 * 60 * 60_000)),
      formatRel(ago(2 * 24 * 60 * 60_000))
    ]
    for (const out of samples) {
      expect(out).not.toMatch(/[가-힣]/)
    }
  })
})
```

- [ ] **Step 3: 테스트 실행 → 실패 확인**

```bash
pnpm -C packages/core exec vitest run test/render/formatRel.test.ts
```

Expected: FAIL — 모든 케이스가 한국어 출력("5초 전" 등)을 반환하므로 영어 매칭 실패.

- [ ] **Step 4: Commit (RED)**

```bash
git add packages/core/test/render/formatRel.test.ts packages/core/src/render/index.ts
git commit -m "test(core): add failing tests for English formatRel"
```

---

## Task 2: `formatRel` 영어 출력 — Implementation (GREEN)

**Files:**
- Modify: `packages/core/src/render/index.ts:236-242`

- [ ] **Step 1: `formatRel` 본문을 영어로 교체**

`packages/core/src/render/index.ts`의 `formatRel` 함수 전체를 다음으로 교체:

```typescript
function formatRel(d: Date): string {
  const s = Math.floor((Date.now() - d.getTime()) / 1000)
  if (s < 60) return `${s} sec ago`
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} hr ago`
  const days = Math.floor(s / 86400)
  return `${days} day${days === 1 ? '' : 's'} ago`
}
```

- [ ] **Step 2: 테스트 실행 → 통과 확인**

```bash
pnpm -C packages/core exec vitest run test/render/formatRel.test.ts
```

Expected: PASS (5/5 케이스).

- [ ] **Step 3: 전체 core 테스트 실행 → 회귀 없음 확인**

```bash
pnpm -C packages/core test
```

Expected: 모든 기존 테스트 통과 (`formatRel` 변경이 다른 테스트에 영향 없음).

- [ ] **Step 4: Commit (GREEN)**

```bash
git add packages/core/src/render/index.ts
git commit -m "feat(core): English output for formatRel (sec/min/hr/day ago)"
```

---

## Task 3: PNG 어트리뷰션 추가 (`chrome` 라벨)

**Files:**
- Modify: `packages/core/src/render/index.ts:178`

- [ ] **Step 1: `chrome()` 함수의 children 텍스트 수정**

`packages/core/src/render/index.ts:178` 한 줄을 수정:

```diff
- children: `${ex.sourceLabel} · ${formatRel(ex.timestamp)}`
+ children: `${ex.sourceLabel} · ${formatRel(ex.timestamp)} · via Promptshot`
```

- [ ] **Step 2: core 빌드 확인**

```bash
pnpm -C packages/core build
```

Expected: 빌드 성공, `dist/` 갱신.

- [ ] **Step 3: 전체 core 테스트 재실행**

```bash
pnpm -C packages/core test
```

Expected: 통과 (텍스트 변경은 기존 테스트와 무관).

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/render/index.ts
git commit -m "feat(core): add 'via Promptshot' attribution to PNG chrome label"
```

---

## Task 4: Markdown 어트리뷰션 추가

**Files:**
- Modify: `packages/vscode-ext/src/commands/captureMarkdown.ts:24`

- [ ] **Step 1: Markdown 헤더 라인 수정**

`packages/vscode-ext/src/commands/captureMarkdown.ts:23-31`의 `md` 배열에서 첫 줄만 수정:

```diff
 const md = [
-   `**${ex.sourceLabel}** — ${ex.timestamp.toLocaleString()}`,
+   `**${ex.sourceLabel}** · via Promptshot — ${ex.timestamp.toLocaleString()}`,
     ``,
     `### You`,
     user.text,
     ``,
     `### ${ex.sourceLabel}`,
     ai.text
 ].join('\n')
```

- [ ] **Step 2: vscode-ext 빌드 확인**

```bash
pnpm -C packages/vscode-ext build
```

Expected: 빌드 성공 (`dist/extension.js` 갱신).

- [ ] **Step 3: vscode-ext 활성화 테스트 통과 확인**

```bash
pnpm -C packages/vscode-ext test
```

Expected: 활성화 + 명령 등록 테스트 통과 (텍스트 변경은 명령 ID에 영향 없음). Linux/CI에서는 `xvfb-run`이 필요하지만 로컬 Windows에서는 직접 실행됨. 환경 의존 실패 시 다음 태스크에서 vscode-ext 빌드만 검증하고 통합 검증은 Task 10으로 미룸.

- [ ] **Step 4: Commit**

```bash
git add packages/vscode-ext/src/commands/captureMarkdown.ts
git commit -m "feat(vscode-ext): add 'via Promptshot' attribution to markdown header"
```

---

## Task 5: 영어 샘플 콘텐츠로 교체

**Files:**
- Modify: `scripts/generate-samples.mjs:11-16`

- [ ] **Step 1: `samples` 객체를 영어로 교체**

`scripts/generate-samples.mjs:11-16`의 `samples` 정의를 다음으로 교체:

```javascript
const samples = {
  short:   { user: 'Hi!', assistant: 'Hello! How can I help?' },
  code:    { user: 'Show me a TypeScript one-liner', assistant: '```ts\nconst x: number = 1\nconsole.log(x)\n```' },
  table:   { user: 'Give me a small table', assistant: '| Item | Value |\n|---|---|\n| 1 | A |\n| 2 | B |' },
  longish: { user: 'Give me a longer answer with formatting', assistant: '## Heading\n\n- First point\n- Second point\n- Third point\n\n**Bold** and *italic* and `inline code`.' }
}
```

(파일의 다른 부분은 손대지 않음 — `for` 루프, 경로, theme 처리 그대로 유지.)

- [ ] **Step 2: 파일이 정상 파싱되는지 확인**

```bash
node --check scripts/generate-samples.mjs
```

Expected: 출력 없음 (구문 OK).

- [ ] **Step 3: Commit (PNG 재생성은 다음 태스크에서)**

```bash
git add scripts/generate-samples.mjs
git commit -m "chore(samples): switch demo content to English"
```

---

## Task 6: 샘플 PNG 8개 재생성

**Files:**
- Regenerate: `docs/samples/mac-light-{short,code,table,longish}.png` (4개)
- Regenerate: `docs/samples/mac-dark-{short,code,table,longish}.png` (4개)

- [ ] **Step 1: core 빌드 (필수 — 스크립트가 `packages/core/dist/index.js`를 직접 import)**

```bash
pnpm -C packages/core build
```

Expected: 빌드 성공.

- [ ] **Step 2: 샘플 PNG 생성**

```bash
node scripts/generate-samples.mjs
```

Expected stdout (8개 라인, 각각 바이트 수 포함):
```
wrote <repo>/docs/samples/mac-light-short.png <N> bytes
wrote <repo>/docs/samples/mac-light-code.png <N> bytes
wrote <repo>/docs/samples/mac-light-table.png <N> bytes
wrote <repo>/docs/samples/mac-light-longish.png <N> bytes
wrote <repo>/docs/samples/mac-dark-short.png <N> bytes
wrote <repo>/docs/samples/mac-dark-code.png <N> bytes
wrote <repo>/docs/samples/mac-dark-table.png <N> bytes
wrote <repo>/docs/samples/mac-dark-longish.png <N> bytes
done
```

- [ ] **Step 3: `git status`로 8개 PNG가 변경되었는지 확인**

```bash
git status docs/samples/
```

Expected: 8개 PNG 모두 `modified`로 표시.

- [ ] **Step 4: 시각 검증 — README가 참조하는 `mac-light-longish.png` 직접 열기**

```bash
start docs/samples/mac-light-longish.png
```

(macOS: `open`, Linux: `xdg-open`)

Expected: 이미지에 다음이 모두 노출:
- 상단 라벨: `Codex · 0 sec ago · via Promptshot` (또는 비슷한 영어 시간 표현)
- "You" 섹션에 `Give me a longer answer with formatting`
- 응답 섹션에 영어 헤딩 "Heading", 영어 리스트 항목 ("First point" 등)
- 한국어 문자 없음

수동 점검 항목 중 하나라도 실패하면: Task 1-5 변경이 빌드에 반영됐는지 확인하고 (`pnpm -C packages/core build` 재실행 후) Step 2 다시 실행.

- [ ] **Step 5: Commit**

```bash
git add docs/samples/
git commit -m "chore(samples): regenerate sample PNGs with English content + attribution"
```

---

## Task 7: CHANGELOG.md 0.1.3 섹션 추가

**Files:**
- Modify: `CHANGELOG.md` (최상단에 새 섹션 삽입)

- [ ] **Step 1: `CHANGELOG.md` 최상단(`## [0.1.2]` 바로 위)에 새 섹션 추가**

`CHANGELOG.md`의 4행 `## [0.1.2] — 2026-05-18` 바로 앞에 다음을 삽입:

```markdown
## [0.1.3] — 2026-05-22

### Added
- **Attribution line on every capture.** Both PNG (window chrome label) and markdown output now include ` · via Promptshot` so shared captures show their source. Example: `Claude Code · 5 min ago · via Promptshot`.

### Changed
- **Relative timestamps are now in English.** PNG chrome label changes from `5분 전 / 3시간 전 / 2일 전` to `5 min ago / 3 hr ago / 2 days ago`. Promptshot is a global-audience Marketplace extension; the previous Korean-only output limited shareability.
- **README sample images are now in English.** Marketplace listing now shows English demo content instead of Korean.

```

(빈 줄 한 줄로 다음 섹션과 구분.)

- [ ] **Step 2: 다른 섹션이 그대로 보존되었는지 시각 확인**

```bash
head -30 CHANGELOG.md
```

Expected: 새 0.1.3 섹션 → 0.1.2 → 0.1.1 → 0.1.0 순서.

- [ ] **Step 3: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs: add 0.1.3 changelog entry"
```

---

## Task 8: 버전 0.1.3 bump

**Files:**
- Modify: `packages/vscode-ext/package.json:5`

- [ ] **Step 1: `version` 필드 수정**

`packages/vscode-ext/package.json:5`:

```diff
-  "version": "0.1.2",
+  "version": "0.1.3",
```

(다른 필드는 손대지 않음.)

- [ ] **Step 2: pnpm lockfile이 영향받는지 확인 (가벼운 점검)**

```bash
pnpm install --frozen-lockfile
```

Expected: 성공. version 변경만으로는 lockfile이 영향받지 않음 (`workspace:*` 참조이므로). 실패하면 lockfile 재생성:

```bash
pnpm install
```

(이 경우 `pnpm-lock.yaml`도 같이 스테이지)

- [ ] **Step 3: 빌드/테스트 한 번 더**

```bash
pnpm -r build
pnpm -r test
```

Expected: 모두 그린.

- [ ] **Step 4: Commit**

`pnpm-lock.yaml`이 변경되지 않은 경우:

```bash
git add packages/vscode-ext/package.json
git commit -m "release: 0.1.3 — via Promptshot attribution + English samples"
```

변경된 경우 lockfile도 함께:

```bash
git add packages/vscode-ext/package.json pnpm-lock.yaml
git commit -m "release: 0.1.3 — via Promptshot attribution + English samples"
```

---

## Task 9: 전체 검증 — 빌드 + 테스트 그린

**Files:** (변경 없음 — 검증만)

- [ ] **Step 1: clean install 후 빌드**

```bash
pnpm install --frozen-lockfile
pnpm -r build
```

Expected: 두 패키지 모두 빌드 성공. `packages/vscode-ext/dist/extension.js`가 10MB 내외 단일 번들로 생성.

- [ ] **Step 2: 전체 테스트**

```bash
pnpm -r test
```

Expected: core (vitest) + vscode-ext (mocha) 모두 통과. `formatRel.test.ts`의 신규 5개 케이스 포함. (Windows에서 `xvfb-run` 불요; CI Linux에서만 필요하지만 워크플로에 이미 반영됨.)

- [ ] **Step 3: 어디서도 한국어 잔재가 없는지 빠른 확인**

```bash
git diff v0.1.2..HEAD -- 'packages/**/*.ts' 'scripts/**/*.mjs' | grep -E '[가-힣]'
```

Expected: 빈 출력 (이번 변경분의 코드/스크립트에 한국어 없음). 매치가 나오면 해당 위치를 검토 — 다만 spec 문서/CLAUDE.md 등 문서 한국어는 정상이므로 검색 범위를 코드/스크립트로 한정한다는 점에 유의.

- [ ] **Step 4: PNG 어트리뷰션 + 영어 라벨 마지막 시각 확인**

```bash
start docs/samples/mac-dark-longish.png
```

Expected: 다크 테마에서도 동일하게 ` · via Promptshot` + 영어 콘텐츠 표시.

(이 태스크는 commit 없음 — 검증만)

---

## Task 10: VS Code Extension Development Host 수동 검증

**Files:** (변경 없음 — 수동 E2E)

이 단계는 실제 VS Code에서 확장이 동작하는지 보는 게이트. 빌드된 dist를 그대로 확인.

- [ ] **Step 1: VS Code에서 `packages/vscode-ext`를 열고 F5로 Extension Development Host 실행**

VS Code에서 `packages/vscode-ext` 폴더 열기 → F5 (또는 Run → Start Debugging).

Expected: 새 VS Code 창이 열림 (Extension Development Host).

- [ ] **Step 2: Extension Development Host에서 Codex 또는 Claude Code 세션이 있는 워크스페이스 열기**

(없으면 fixture 세션 파일을 임시로 사용하거나, 이 기기에서 평소 사용하던 워크스페이스 사용.)

- [ ] **Step 3: `Ctrl+Alt+Shift+P` → "Promptshot: Capture as Markdown" 실행**

Expected: 클립보드에 Markdown이 복사됨. notification: `Markdown copied` (또는 redacted suffix). 클립보드 내용을 텍스트 에디터에 붙여넣어 다음 패턴 확인:

```
**Claude Code** · via Promptshot — 2026-...
```

또는 source가 Codex라면:
```
**Codex** · via Promptshot — 2026-...
```

- [ ] **Step 4: `Ctrl+Alt+P` → "Promptshot: Capture Last Exchange" 실행**

Expected: notification `Captured · <Source>`. 알림에서 "Open File" 선택 → 저장된 PNG 열림 → 상단 라벨에 `<Source> · X min ago · via Promptshot` 노출.

- [ ] **Step 5: 둘 중 하나라도 실패하면 원인 분석 후 해당 Task로 돌아가서 수정**

(이 태스크는 commit 없음 — 수동 게이트)

---

## Task 11: 태그 + 머지 준비

**Files:** (변경 없음 — 릴리스 준비)

이 태스크는 사용자가 발행하기로 결정한 시점에 별도로 진행. 빌드/머지/태그/푸시는 사용자 명시 승인 후 실행.

- [ ] **Step 1: 사용자에게 발행 진행 여부 확인**

CLAUDE.md 발행 워크플로의 5~10단계 (태그 → push → CI → vsce publish)는 사용자 명시 승인 필요. 이 plan은 Task 10까지의 로컬 검증으로 종료하고, 발행은 별도 게이트.

- [ ] **Step 2 (사용자 승인 후): 태그 + push**

```bash
git tag v0.1.3
git push
git push --tags
```

- [ ] **Step 3 (사용자 승인 후): GitHub Actions 통과 후 .vsix 생성 + publish**

```bash
pnpm -C packages/vscode-ext package
pnpm -C packages/vscode-ext exec vsce publish --packagePath promptshot-0.1.3.vsix
```

Expected: `https://marketplace.visualstudio.com/items?itemName=sunio.promptshot` 에서 0.1.3 노출.

---

## Self-Review Notes

- **Spec coverage 점검**: spec의 2.1~2.5 모두 Task 1-6에 대응. CHANGELOG/버전 동기화는 Task 7-8. 검증은 Task 9-10.
- **Placeholder 스캔**: TBD/TODO 없음. 모든 step에 실제 명령·코드 포함.
- **Type 일관성**: `formatRel(d: Date): string` 시그니처 변경 없음. `__test__` 네임스페이스 export 패턴은 기존 `applyMaxHeight`와 동일.
- **YAGNI 준수**: 어트리뷰션 토글 설정 없음. i18n 없음. 별도 모듈 분리 없음 (`formatRel`은 `index.ts` 내부 유지).

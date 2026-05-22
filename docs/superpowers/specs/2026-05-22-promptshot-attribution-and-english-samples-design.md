# Promptshot — Attribution + English Samples Design Spec

- **Date**: 2026-05-22
- **Author**: sunio (with brainstorming assistance)
- **Status**: Draft v1
- **Scope**: 단일 변경 단위. 어트리뷰션 문구 추가 + README 샘플 이미지 영어화

## 1. Overview

Promptshot이 생성하는 두 가지 산출물(PNG · Markdown) 모두에 "via Promptshot" 어트리뷰션을 한 줄로 추가하고, 그에 맞춰 Marketplace 페이지에 노출되는 README 샘플 이미지를 영어로 재생성한다.

### 1.1 Motivation

- 캡쳐된 이미지·마크다운이 슬랙/이메일/위키로 공유될 때 **출처가 promptshot임이 자연스럽게 드러나지 않음** — 가벼운 어트리뷰션이 도구 인지도를 높이는 동시에 캡쳐가 어떤 도구로 생성됐는지 명시함.
- README의 샘플 이미지(`docs/samples/mac-light-longish.png` 등)가 한국어 콘텐츠로 되어 있어 Marketplace 글로벌 관객(영어권 다수)에게 즉시 가치를 전달하기 어려움.

### 1.2 Goals

- ✅ PNG 창 상단 메타 라인에 `· via Promptshot` 추가
- ✅ Markdown 첫 줄 헤더에 `· via Promptshot` 추가
- ✅ `formatRel` 상대 시간 표현을 영어로 통합 (글로벌 도구의 표준 출력)
- ✅ `scripts/generate-samples.mjs` 샘플 콘텐츠를 영어로 교체
- ✅ `docs/samples/*.png` 8개 (light/dark × 4 variants) 재생성
- ✅ CLAUDE.md 문서 동기화 규칙 준수 (CHANGELOG, README 영향 점검)

### 1.3 Non-Goals

- ❌ `promptshot.attribution` 등의 토글 설정 (수요 검증 전 YAGNI)
- ❌ 시스템 locale 기반 i18n (현재 영어 단일 출력으로 단순화)
- ❌ 절대 시간 vs 상대 시간 토글
- ❌ 다국어 fixture / 다국어 샘플 동시 유지
- ❌ 어트리뷰션을 PNG 워터마크/푸터 등 별도 영역에 두는 디자인
- ❌ Markdown 하단 footer 형태 어트리뷰션
- ❌ 버전 번호 어트리뷰션 (예: "via Promptshot v0.1.3") — 향후 필요 시 추가

### 1.4 User Stories

1. *팀원이 슬랙에서 promptshot 결과 이미지를 봄 → 상단 라벨 `Claude Code · 5 min ago · via Promptshot`에서 도구를 인지 → 본인도 설치.*
2. *위키에 promptshot Markdown을 붙여넣음 → 첫 줄 `**Claude Code** · via Promptshot — 2026-05-22 14:30`로 출처/시점이 명확.*
3. *영어권 개발자가 Marketplace에서 promptshot 페이지 열람 → 영어 샘플 이미지로 즉시 가치 파악.*

## 2. Changes

### 2.1 PNG 상단 메타 라인 (`packages/core/src/render/index.ts`)

`chrome()` 함수 내부 — 라인 178:
```diff
- children: `${ex.sourceLabel} · ${formatRel(ex.timestamp)}`
+ children: `${ex.sourceLabel} · ${formatRel(ex.timestamp)} · via Promptshot`
```

렌더링 결과:
```
○ ● ●    Claude Code · 5 min ago · via Promptshot
```

스타일은 기존 `theme.textSecondary` + `fontSize: '12px'` 그대로 유지 (디자인 일관성 + 변경 최소화).

### 2.2 Markdown 헤더 (`packages/vscode-ext/src/commands/captureMarkdown.ts`)

라인 24:
```diff
const md = [
-   `**${ex.sourceLabel}** — ${ex.timestamp.toLocaleString()}`,
+   `**${ex.sourceLabel}** · via Promptshot — ${ex.timestamp.toLocaleString()}`,
    ``,
    `### You`,
    ...
]
```

출력:
```markdown
**Claude Code** · via Promptshot — 2026-05-22 14:30:00

### You
hello

### Claude Code
hi! how can I help?
```

### 2.3 `formatRel` 영어화 (`packages/core/src/render/index.ts`)

라인 236-242 변환:
```diff
 function formatRel(d: Date): string {
   const s = Math.floor((Date.now() - d.getTime()) / 1000)
-  if (s < 60) return `${s}초 전`
-  if (s < 3600) return `${Math.floor(s / 60)}분 전`
-  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`
-  return `${Math.floor(s / 86400)}일 전`
+  if (s < 60) return `${s} sec ago`
+  const m = Math.floor(s / 60)
+  if (s < 3600) return `${m} min ago`
+  const h = Math.floor(s / 3600)
+  if (s < 86400) return `${h} hr ago`
+  const days = Math.floor(s / 86400)
+  return `${days} day${days === 1 ? '' : 's'} ago`
 }
```

복수형 처리 차이만 명시적으로 분기 (`1 day ago` vs `2 days ago`). `sec`/`min`/`hr`은 보편 약자라 단/복수 분기 없음.

### 2.4 영어 샘플 콘텐츠 (`scripts/generate-samples.mjs`)

`samples` 객체를 영어로 교체:
```javascript
const samples = {
  short: {
    user: 'Hi!',
    assistant: 'Hello! How can I help?'
  },
  code: {
    user: 'Show me a TypeScript one-liner',
    assistant: '```ts\nconst x: number = 1\nconsole.log(x)\n```'
  },
  table: {
    user: 'Give me a small table',
    assistant: '| Item | Value |\n|---|---|\n| 1 | A |\n| 2 | B |'
  },
  longish: {
    user: 'Give me a longer answer with formatting',
    assistant: '## Heading\n\n- First point\n- Second point\n- Third point\n\n**Bold** and *italic* and `inline code`.'
  }
}
```

코드 블록 내부는 언어 중립이므로 그대로 유지. 표 헤더·셀, 텍스트 본문만 영어로.

### 2.5 샘플 PNG 재생성

```bash
pnpm -C packages/core build
node scripts/generate-samples.mjs
```

산출물 8개 (덮어쓰기):
- `docs/samples/mac-light-short.png`
- `docs/samples/mac-light-code.png`
- `docs/samples/mac-light-table.png`
- `docs/samples/mac-light-longish.png` ← README가 참조
- `docs/samples/mac-dark-short.png`
- `docs/samples/mac-dark-code.png`
- `docs/samples/mac-dark-table.png`
- `docs/samples/mac-dark-longish.png`

## 3. Impact Analysis

### 3.1 코드 영향

| 파일 | 변경 |
|---|---|
| `packages/core/src/render/index.ts` | `chrome()` 텍스트 + `formatRel` 영어화 |
| `packages/vscode-ext/src/commands/captureMarkdown.ts` | 헤더 라인에 `· via Promptshot` |
| `scripts/generate-samples.mjs` | samples 객체 영어 콘텐츠 |
| `docs/samples/*.png` | 8개 재생성 (덮어쓰기) |

### 3.2 사용자 영향

- 기존 사용자: PNG 상단 라벨 텍스트가 한국어 → 영어로 변경 + ` · via Promptshot` 부분 추가. Markdown 첫 줄에 ` · via Promptshot` 추가.
- 신규 사용자: 영어 샘플로 첫인상이 글로벌 친화적.
- API/명령/키바인딩/설정 **변경 없음** — Marketplace 페이지에서 사용자가 새로 설정할 필요 없음.

### 3.3 테스트 영향

- `packages/core/test/**`: `formatRel`은 export되지 않은 내부 함수. 직접 테스트하지 않음. 렌더링 테스트는 PNG 바이너리 비교가 아니므로 영향 없음.
- `packages/vscode-ext/test/**`: 클립보드 텍스트 검증이 있다면 영향 가능 — 확인 필요. (현재 활성화 테스트만 있는 것으로 보임)

### 3.4 문서 동기화 (CLAUDE.md 체크리스트)

- ✅ **새 기능 / 동작 변경** → `CHANGELOG.md` 0.1.3 Unreleased 섹션 추가 (`### Changed` 카테고리)
- ⏸️ **버전 변경**: 발행 시점에 0.1.2 → 0.1.3 bump (이 spec 단계에서 결정 불요; plan 단계에서 처리)
- ✅ **README**: 이미지 경로 동일 (`docs/samples/mac-light-longish.png`)이므로 README 텍스트 변경 없음. 이미지 파일만 교체.
- ✅ **DECISIONS.md**: 작은 사용자 경험 변경. ADR 불필요 (의존성·아키텍처 변경 없음).

## 4. Testing Plan

1. `pnpm -r build && pnpm -r test` 로 기존 테스트 그린 유지
2. `node scripts/generate-samples.mjs` 실행 후 `docs/samples/*.png` 8개 모두 시각적으로 확인 (영어 콘텐츠 + ` · via Promptshot` 표시)
3. VS Code Extension Development Host (F5)에서 `Promptshot: Capture as Markdown` 실행 → 클립보드 텍스트에 ` · via Promptshot` 포함 확인
4. 동일 호스트에서 `Promptshot: Capture Last Exchange` (PNG) 실행 → 저장된 PNG에 ` · via Promptshot` 노출 확인
5. (선택) README 미리보기에서 새 영어 샘플 이미지 렌더링 확인

## 5. Rollout

이 spec은 단일 PR로 처리 가능. 버전 0.1.3으로 발행 후 Marketplace 페이지에서 영어 샘플 이미지 노출.

릴리스 단계 (CLAUDE.md 발행 워크플로):
1. spec → plan → 구현
2. 로컬 빌드 + 테스트
3. `packages/vscode-ext/package.json` 버전 0.1.3
4. `CHANGELOG.md` Unreleased → 2026-05-22 날짜
5. `release: 0.1.3` 커밋 + `v0.1.3` 태그
6. push + Actions 통과 확인
7. `.vsix` 생성 + `vsce publish`

## 6. Open Questions

(없음 — 모든 결정 brainstorming 단계에서 확정)

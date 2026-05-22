# Promptshot — Redaction Pattern Expansion Design Spec

- **Date**: 2026-05-22
- **Author**: sunio (security-review-driven)
- **Status**: Draft v1
- **Scope**: v0.1.4 — redaction 패턴 6종 추가

## 1. Overview

v0.1.3 보안 검토에서 도출된 핵심 권고: 기존 redaction 5개 패턴(OpenAI/GitHub/JWT/AWS/Google)으로는 흔히 사용되는 시크릿이 노출될 수 있다. 6개 패턴(`private_key`, `anthropic`, `slack`, `stripe`, `db_url`, `bearer`)을 추가하고 매치 우선순위를 재정렬한다.

### 1.1 Motivation

- Promptshot의 약속 중 하나는 "자동 redaction" — 사용자가 캡쳐 후 공유 시 시크릿을 노출하지 않는 것
- 현재 패턴은 OpenAI 1종만 LLM API 키를 다룸. **Anthropic(Claude)** 사용자가 다수임을 고려하면 핵심 누락
- Private key는 PEM 블록 전체를 통째로 노출하면 직접 사용 가능한 심각도 → 우선 보완 대상

### 1.2 Goals

- ✅ 자주 사용되는 6개 시크릿 종류를 자동 마스킹
- ✅ 패턴 순서를 명시적으로 관리 (구체 > 일반, multiline > inline)
- ✅ 각 패턴마다 단위 테스트 추가
- ✅ 기존 5개 패턴 동작 회귀 없음

### 1.3 Non-Goals

- ❌ redact 토글 설정 (보안 도구는 default-on)
- ❌ 사용자 정의 패턴 추가 (YAGNI)
- ❌ entropy 기반 검출 (false positive 방지 복잡)
- ❌ 마스킹 알고리즘 변경 (현재 `m.slice(0,3) + '*'.repeat(...)` 유지)
- ❌ 비밀번호 단독 검출 (컨텍스트 의존, false positive 폭증)

## 2. Changes

### 2.1 `packages/core/src/redact/patterns.ts` 전체 교체

```typescript
export type RedactPattern = { name: string; regex: RegExp }

export const PATTERNS: RedactPattern[] = [
  // ① Multi-line block — 가장 먼저
  { name: 'private_key', regex: /-----BEGIN [A-Z ]+PRIVATE KEY-----[\s\S]+?-----END [A-Z ]+PRIVATE KEY-----/g },
  // ② 더 구체적인 prefix가 일반보다 먼저
  { name: 'anthropic', regex: /sk-ant-[A-Za-z0-9_-]{20,}/g },
  { name: 'jwt',       regex: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}/g },
  // ③ 일반 토큰
  { name: 'openai',  regex: /sk-[A-Za-z0-9]{20,}/g },
  { name: 'github',  regex: /gh[ps]_[A-Za-z0-9]{30,}/g },
  { name: 'slack',   regex: /xox[abpsrn]-[A-Za-z0-9-]{10,}/g },
  { name: 'stripe',  regex: /(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{20,}/g },
  { name: 'aws',     regex: /AKIA[0-9A-Z]{16}/g },
  { name: 'google',  regex: /AIza[0-9A-Za-z_-]{35}/g },
  // ④ DB URL with credentials
  { name: 'db_url',  regex: /(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|amqps?):\/\/[^\s'"<>]+:[^\s'"<>]+@[^\s'"<>]+/g },
  // ⑤ Bearer catch-all (JWT 후 잔여)
  { name: 'bearer',  regex: /Bearer\s+[A-Za-z0-9._~+\/=-]{20,}/g }
]
```

### 2.2 우선순위 근거

| 순서 | 패턴 | 왜 이 위치인가 |
|---|---|---|
| 1 | `private_key` | PEM 블록 전체. 안에 포함된 base64가 다른 패턴에 잘못 매치되는 것 차단 |
| 2 | `anthropic` | `sk-ant-` prefix가 `sk-` prefix를 포함. OpenAI보다 먼저 두지 않으면 라벨이 `openai`로 잘못 표시 |
| 3 | `jwt` | `Bearer eyJ...` 형태가 흔함. `bearer` catch-all보다 먼저 매치되어야 정확한 라벨 |
| 4-9 | 기존 + slack/stripe | 서로 prefix 겹침 없음. 순서 무관 |
| 10 | `db_url` | URL 형식이라 다른 토큰과 겹침 없음 |
| 11 | `bearer` | catch-all — JWT 이미 처리 후 남은 Bearer 토큰만 |

### 2.3 마스킹 동작 (변경 없음)

`redactSecrets`(`packages/core/src/redact/index.ts`)은 그대로 — 매치된 문자열을 `m.slice(0, 3) + '*'.repeat(Math.max(3, m.length - 3))`로 치환. 즉:
- `sk-ant-api03-abc...xyz` → `sk-*********************`
- `-----BEGIN RSA PRIVATE KEY----- ABC... -----END RSA PRIVATE KEY-----` → `---***...***`
- `postgres://user:pw@host/db` → `pos*********************`

### 2.4 테스트 (`packages/core/test/redact.test.ts`)

기존 4개 케이스 유지 + 다음 7개 신규 케이스:

- `masks Anthropic sk-ant- keys` → `sk-ant-api03-...` 매치, hits에 `anthropic`
- `masks Slack tokens` → `xoxb-...`, `xoxp-...`, `xapp-...` (3종 변형)
- `masks Stripe keys` → `sk_live_`, `sk_test_`, `pk_live_`, `pk_test_`, `rk_live_` 매치
- `masks private key blocks` → multiline `BEGIN/END` 블록 매치
- `masks database URLs with credentials` → `postgres://`, `mysql://`, `mongodb+srv://`
- `masks generic Bearer tokens` → `Bearer abc123...` 매치, JWT는 jwt로 매치
- `Anthropic key matched as anthropic, not openai` — 순서 검증

## 3. Impact Analysis

### 3.1 코드 영향

| 파일 | 변경 |
|---|---|
| `packages/core/src/redact/patterns.ts` | 6개 패턴 추가 + 순서 재정렬 |
| `packages/core/test/redact.test.ts` | 신규 7개 테스트 케이스 |
| `CHANGELOG.md` | 0.1.4 섹션 (Added: 6 secret patterns) |
| `packages/vscode-ext/package.json` | 0.1.3 → 0.1.4 |

### 3.2 사용자 영향

- 기존 사용자: redact가 더 많이 캡쳐. 알림에 새 라벨(`anthropic`, `slack`, ...) 표시
- 거짓 양성 가능성: Bearer/DB URL은 false positive 위험 — 실제 토큰만큼 길이가 긴 일반 텍스트가 매치될 수도. 그러나 마스킹은 정보 손실만이지 보안 후퇴는 없음

### 3.3 테스트 영향

- 기존 4개 단위 테스트 그대로 통과해야 함
- 신규 7개 테스트 추가

### 3.4 문서 동기화

- `CHANGELOG.md` 0.1.4 섹션
- 버전 0.1.3 → 0.1.4
- README/spec 변경 없음 (redaction은 자동)

## 4. Testing Plan

1. `pnpm -C packages/core exec vitest run test/redact.test.ts` 신규/기존 케이스 모두 통과
2. `pnpm -r build && pnpm -r test` 전체 그린
3. 수동 검증: 실제 시크릿 형태로 마크다운 캡쳐 → 알림에 `Redacted: anthropic, slack`처럼 노출 확인 (선택)

## 5. Rollout

1. spec → plan → 구현 (TDD: RED → GREEN)
2. 버전 0.1.4 bump + CHANGELOG
3. `release: 0.1.4 — expanded redaction patterns` 커밋
4. `git tag v0.1.4 && git push --tags`
5. CI 통과 후 별도 `.vsix` + publish (사용자 명시 승인)

## 6. Open Questions

(없음)

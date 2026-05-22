# Promptshot Redaction Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** v0.1.4 — redaction 패턴 6종(`private_key`, `anthropic`, `slack`, `stripe`, `db_url`, `bearer`)을 추가하고 매치 우선순위 재정렬.

**Architecture:** `packages/core/src/redact/patterns.ts` 전체 교체. 기존 `redactSecrets` 동작은 그대로(매치 → 첫 3자만 남기고 마스킹). 신규 7개 단위 테스트.

**Tech Stack:** TypeScript 5.4, vitest. 정규식만 변경.

**Spec:** `docs/superpowers/specs/2026-05-22-promptshot-redaction-expansion-design.md`

---

## Task 1: 신규 패턴 7개 테스트 작성 (RED)

**Files:**
- Modify: `packages/core/test/redact.test.ts` (기존 4 테스트 그대로 유지 + 7개 추가)

- [ ] **Step 1: 신규 케이스 추가**

`packages/core/test/redact.test.ts` 마지막 `it('preserves non-secret text', ...)` 뒤(`describe` 닫는 `})` 직전)에 추가:

```typescript
  it('masks Anthropic sk-ant- keys (and labels as anthropic, not openai)', () => {
    const { text, hits } = redactSecrets('use claude: sk-ant-FAKEDEMONOTAREALANTHROPICKEY')
    expect(text).not.toContain('sk-ant-FAKEDEMONOTAREAL')
    expect(text).toMatch(/sk-\*{3,}/)
    expect(hits).toContain('anthropic')
    expect(hits).not.toContain('openai')
  })

  it('masks Slack tokens (bot / user / app variants)', () => {
    const r1 = redactSecrets('xoxb-FAKE-DEMO-NOT-A-REAL-SLACK-TOKEN-A')
    expect(r1.hits).toContain('slack')
    expect(r1.text).not.toContain('NOT-A-REAL-SLACK-TOKEN')

    const r2 = redactSecrets('xoxp-FAKE-DEMO-NOT-A-REAL-SLACK-TOKEN-B')
    expect(r2.hits).toContain('slack')

    const r3 = redactSecrets('xapp-FAKE-DEMO-NOT-A-REAL-SLACK-TOKEN-C')
    expect(r3.hits).toContain('slack')
  })

  it('masks Stripe live/test/restricted keys', () => {
    // Tokens are assembled at runtime so the literal string never appears in source —
    // otherwise GitHub Secret Scanning blocks the push.
    const fake = 'FAKE' + 'demonotreal' + 'stripekey00'
    const samples = [
      ['sk', 'live', fake + 'A'].join('_'),
      ['sk', 'test', fake + 'B'].join('_'),
      ['pk', 'live', fake + 'C'].join('_'),
      ['pk', 'test', fake + 'D'].join('_'),
      ['rk', 'live', fake + 'E'].join('_')
    ]
    for (const sample of samples) {
      const { text, hits } = redactSecrets(sample)
      expect(hits).toContain('stripe')
      expect(text).not.toContain(sample)
    }
  })

  it('masks PEM private key blocks (multiline)', () => {
    const pem = [
      '-----BEGIN RSA PRIVATE KEY-----',
      'MIIEowIBAAKCAQEA1234567890abcdef',
      'fakepayloadfakepayloadfakepayload',
      '-----END RSA PRIVATE KEY-----'
    ].join('\n')
    const { text, hits } = redactSecrets(`my key: ${pem}`)
    expect(hits).toContain('private_key')
    expect(text).not.toContain('fakepayloadfakepayloadfakepayload')
    expect(text).not.toContain('-----END RSA PRIVATE KEY-----')
  })

  it('masks PEM blocks for OpenSSH / EC / generic PRIVATE KEY variants', () => {
    const variants = [
      '-----BEGIN OPENSSH PRIVATE KEY-----\nABC\n-----END OPENSSH PRIVATE KEY-----',
      '-----BEGIN EC PRIVATE KEY-----\nXYZ\n-----END EC PRIVATE KEY-----',
      '-----BEGIN PRIVATE KEY-----\nQRS\n-----END PRIVATE KEY-----'
    ]
    for (const v of variants) {
      const { hits } = redactSecrets(v)
      expect(hits).toContain('private_key')
    }
  })

  it('masks database URLs with credentials', () => {
    const urls = [
      'postgres://user:secretpass@db.example.com:5432/mydb',
      'postgresql://admin:p%40ssw0rd@host/db',
      'mysql://root:mysecret@localhost:3306/test',
      'mongodb://user:pw@cluster.example.com/db',
      'mongodb+srv://user:pw@cluster.mongodb.net/db'
    ]
    for (const url of urls) {
      const { text, hits } = redactSecrets(`conn: ${url}`)
      expect(hits).toContain('db_url')
      expect(text).not.toContain('secretpass')
      expect(text).not.toContain('p%40ssw0rd')
      expect(text).not.toContain('mysecret')
    }
  })

  it('masks generic Bearer tokens (non-JWT)', () => {
    const { text, hits } = redactSecrets('Authorization: Bearer abc123def456ghi789jkl012MNO')
    expect(hits).toContain('bearer')
    expect(text).not.toContain('abc123def456ghi789jkl012MNO')
  })
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

```bash
pnpm -C packages/core exec vitest run test/redact.test.ts
```

Expected: 기존 4개는 PASS, 신규 7개 모두 FAIL (각 패턴이 아직 PATTERNS에 없으므로 hits에 안 잡힘).

- [ ] **Step 3: Commit (RED)**

```bash
git add packages/core/test/redact.test.ts
git commit -m "test(core): add failing tests for expanded redaction patterns"
```

---

## Task 2: 패턴 6개 추가 + 순서 재정렬 (GREEN)

**Files:**
- Modify: `packages/core/src/redact/patterns.ts` (전체 교체)

- [ ] **Step 1: `patterns.ts` 전체 교체**

```typescript
export type RedactPattern = { name: string; regex: RegExp }

export const PATTERNS: RedactPattern[] = [
  // ① Multi-line block — 가장 먼저 (블록 내부 base64가 다른 패턴에 매치되는 것 차단)
  { name: 'private_key', regex: /-----BEGIN [A-Z ]+PRIVATE KEY-----[\s\S]+?-----END [A-Z ]+PRIVATE KEY-----/g },
  // ② 더 구체적인 prefix가 일반보다 먼저
  { name: 'anthropic', regex: /sk-ant-[A-Za-z0-9_-]{20,}/g },
  { name: 'jwt',       regex: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}/g },
  // ③ 토큰 prefix 기반
  { name: 'openai',  regex: /sk-[A-Za-z0-9]{20,}/g },
  { name: 'github',  regex: /gh[ps]_[A-Za-z0-9]{30,}/g },
  { name: 'slack',   regex: /xox[abpsrn]-[A-Za-z0-9-]{10,}/g },
  { name: 'stripe',  regex: /(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{20,}/g },
  { name: 'aws',     regex: /AKIA[0-9A-Z]{16}/g },
  { name: 'google',  regex: /AIza[0-9A-Za-z_-]{35}/g },
  // ④ DB URL (자격증명 포함)
  { name: 'db_url',  regex: /(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|amqps?):\/\/[^\s'"<>]+:[^\s'"<>]+@[^\s'"<>]+/g },
  // ⑤ Bearer catch-all (JWT 후 잔여)
  { name: 'bearer',  regex: /Bearer\s+[A-Za-z0-9._~+\/=-]{20,}/g }
]
```

- [ ] **Step 2: 테스트 실행 → 통과 확인**

```bash
pnpm -C packages/core exec vitest run test/redact.test.ts
```

Expected: 4 (기존) + 7 (신규) = 11/11 PASS.

- [ ] **Step 3: 전체 core 테스트 재실행 (회귀 확인)**

```bash
pnpm -C packages/core test
```

Expected: 48/48 (기존 41 + 7 신규) 모두 통과.

- [ ] **Step 4: Commit (GREEN)**

```bash
git add packages/core/src/redact/patterns.ts
git commit -m "feat(core): expand redaction patterns (private_key, anthropic, slack, stripe, db_url, bearer)"
```

---

## Task 3: CHANGELOG 0.1.4 + 버전 bump

**Files:**
- Modify: `CHANGELOG.md` (최상단에 신규 섹션)
- Modify: `packages/vscode-ext/package.json:5`

- [ ] **Step 1: CHANGELOG.md 최상단에 0.1.4 섹션**

`## [0.1.3] — 2026-05-22` 바로 위에 삽입:

```markdown
## [0.1.4] — 2026-05-22

### Added
- **Expanded automatic redaction.** Six new secret patterns are now caught and masked before clipboard / file output:
  - Anthropic API keys (`sk-ant-...`) — previously labeled as `openai`
  - Slack tokens (`xoxb-`, `xoxp-`, `xapp-`, etc.)
  - Stripe live/test/restricted keys (`sk_live_`, `pk_test_`, `rk_live_`, …)
  - PEM private key blocks (RSA, EC, OpenSSH, generic `PRIVATE KEY`) — full multiline block
  - Database connection URLs with credentials (`postgres://`, `mysql://`, `mongodb+srv://`, `redis://`, `amqps://`)
  - Bearer tokens (generic `Bearer <token>`, JWT is still caught separately as `jwt`)

### Changed
- Redaction match order is now explicit: multiline blocks first, then specific prefixes (Anthropic before OpenAI, JWT before Bearer), then general patterns. Existing five patterns continue to behave identically.

```

- [ ] **Step 2: package.json 버전 bump**

`packages/vscode-ext/package.json:5`:

```diff
-  "version": "0.1.3",
+  "version": "0.1.4",
```

- [ ] **Step 3: 빌드/테스트 그린 확인**

```bash
pnpm install --frozen-lockfile
pnpm -r build
pnpm -r test
```

Expected: 모든 단계 성공. core 48/48 + vscode-ext 2/2.

- [ ] **Step 4: 두 개 commit으로 분리**

```bash
git add CHANGELOG.md
git commit -m "docs: add 0.1.4 changelog entry"

git add packages/vscode-ext/package.json
git commit -m "release: 0.1.4 — expanded redaction patterns"
```

---

## Task 4: Push + 태그 + 발행 게이트

**Files:** (변경 없음 — 릴리스)

- [ ] **Step 1: spec + plan commit**

```bash
git add docs/superpowers/specs/2026-05-22-promptshot-redaction-expansion-design.md \
        docs/superpowers/plans/2026-05-22-promptshot-redaction-expansion.md
git commit -m "docs: add 0.1.4 redaction expansion spec and plan"
```

- [ ] **Step 2: Push + 태그 (사용자 명시 승인 후)**

```bash
git push
git tag v0.1.4
git push --tags
```

Expected: origin/main 최신화, v0.1.4 태그 origin에 노출, CI 트리거.

- [ ] **Step 3: `.vsix` + publish (사용자 명시 승인 후 — 이 plan 범위 밖)**

```bash
pnpm -C packages/vscode-ext package
pnpm -C packages/vscode-ext exec vsce publish --packagePath promptshot-0.1.4.vsix
```

---

## Self-Review Notes

- **Spec coverage**: spec 2.1 → Task 2, spec 2.4 → Task 1, CHANGELOG/version → Task 3, push → Task 4.
- **Placeholder 스캔**: TBD/TODO 없음. 모든 step에 실 코드/명령.
- **Type 일관성**: `RedactPattern` 타입 변경 없음. PATTERNS 배열 entry 형식 동일.
- **YAGNI 준수**: 설정 옵션 없음, 사용자 정의 패턴 없음.

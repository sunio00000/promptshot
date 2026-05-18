# Promptshot — Project Rules

## 코드 수정 시 문서 동기화 (필수)

코드 변경의 성격에 따라 **반드시 같이 수정**해야 하는 문서가 정해져 있습니다. 누락 시 사용자 혼란 + Marketplace 페이지 어긋남 + 추후 디버깅 비용 증가.

### 변경 유형별 동기화 체크리스트

| 변경 유형 | 같이 수정할 파일 |
|---|---|
| **명령 추가/삭제/이름 변경** | `packages/vscode-ext/package.json` (contributes.commands + activationEvents) · `README.md` 표 · `packages/vscode-ext/README.md` 표 · `packages/vscode-ext/test/suite/extension.test.ts` (expected 배열) |
| **키바인딩 추가/변경** | `packages/vscode-ext/package.json` (keybindings) · `README.md` 표 · `packages/vscode-ext/README.md` 표 |
| **설정(configuration) 추가/변경** | `packages/vscode-ext/package.json` (configuration.properties) · `packages/vscode-ext/src/config.ts` (getConfig) · `README.md` 설정 표 · `packages/vscode-ext/README.md` 설정 표 |
| **버전 변경** | `packages/vscode-ext/package.json` (version) · `CHANGELOG.md` (새 섹션 + 날짜) · 발행 후 `git tag v<X.Y.Z>` |
| **새 기능 / 동작 변경** | `CHANGELOG.md` 다음 버전 섹션 · 필요 시 `docs/superpowers/specs/2026-05-13-promptshot-design.md` 갱신 |
| **아키텍처/의존성 변경** | `docs/DECISIONS.md` ADR 추가 (최상단) · 필요 시 spec 갱신 |
| **새 디렉토리/패키지** | `pnpm-workspace.yaml` (workspace) · 루트 `tsconfig.base.json` 영향 검토 · `.gitignore` 확인 |
| **번들 의존성 / 폰트 / wasm 추가** | `packages/vscode-ext/build.mjs` (copy-assets) · `packages/vscode-ext/.vscodeignore` |

### CHANGELOG.md 작성 규칙

- 새 변경은 최상단 미발행 섹션(`## [X.Y.Z] — Unreleased` 또는 다음 버전)에 추가
- `### Added` / `### Changed` / `### Fixed` / `### Removed` 카테고리 사용
- 사용자 영향 관점에서 작성 (내부 리팩토링은 생략 OK)
- 발행 시 `Unreleased` → 날짜로 변경

### DECISIONS.md ADR 작성 규칙

다음 경우 ADR 추가 (최상단, 역시간순):
- 새 의존성 도입 (특히 cross-platform 영향)
- 아키텍처 결정 (예: ESM/CJS 분리, 번들 전략 변경)
- 비자명한 트레이드오프 (예: 어떤 fidelity를 포기했는가)
- 임시방편 / 추후 교체 예정 항목 (예: 플레이스홀더 아이콘)

ADR 형식: `Context / Decision / Consequences / Status` 4섹션.

## 발행 워크플로

1. 코드 + 위 체크리스트의 모든 문서 수정
2. `pnpm install --frozen-lockfile && pnpm -r build && pnpm -r test` 로컬 검증
3. 버전 bump (`packages/vscode-ext/package.json`) + `CHANGELOG.md` 날짜 확정
4. 커밋 메시지 `release: X.Y.Z`
5. 태그 `git tag vX.Y.Z`
6. `git push && git push --tags`
7. GitHub Actions CI 통과 확인 (3 OS × 2 Node)
8. `pnpm -C packages/vscode-ext package` 로 `.vsix` 생성
9. `pnpm -C packages/vscode-ext exec vsce publish --packagePath promptshot-X.Y.Z.vsix`
10. `https://marketplace.visualstudio.com/items?itemName=sunio.promptshot` 에서 버전 반영 확인

## 빌드/임포트 규칙

- **`packages/core`**: Node16 module resolution. 모든 상대 import는 `.js` 확장자 명시 (`from '../types.js'`)
- **`packages/vscode-ext`**: CommonJS. 상대 import에 확장자 없음 (`from './config'`)
- 두 패키지 간 경계: vscode-ext에서 core 사용 시 `loadCore()` (esbuild가 번들 시점에 인라인)
- 새 코어 export는 `packages/core/src/index.ts`에 반드시 추가
- 빌드 후 `dist/extension.js` 가 10MB+ 단일 번들이어야 함 (font/wasm은 dist/ 하위에 별도 파일)

## 테스트 규칙

- 새 기능: 최소 한 개 단위 테스트 또는 통합 테스트
- 픽스처는 `packages/core/test/fixtures/` 아래 source별
- mtime 의존하는 테스트는 `beforeAll` 에서 `utimes` 로 결정성 확보
- VS Code 확장 테스트는 `@vscode/test-electron` 사용 (Linux CI는 `xvfb-run` 필요 — `.github/workflows/ci.yml` 이미 반영)
- Test timeout: 번들된 활성화는 ~1-3초 걸릴 수 있으므로 `this.timeout(30000)`

## 문서 참고

- 설계 spec: `docs/superpowers/specs/2026-05-13-promptshot-design.md`
- 결정 기록: `docs/DECISIONS.md`
- 릴리스 가이드: `docs/RELEASE.md`
- 구현 계획: `docs/superpowers/plans/2026-05-13-promptshot.md`
- 샘플 출력: `docs/samples/*.png`

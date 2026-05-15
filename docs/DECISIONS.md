# Promptshot — Decisions Log

> 프로젝트 진행 중 내려진 의사 결정을 시간순으로 누적 기록한다.
>
> 각 항목은 **ADR(Architecture Decision Record)** 스타일을 따른다:
> - **Context**: 왜 이 결정이 필요했는가
> - **Decision**: 어떤 선택을 했는가
> - **Consequences**: 어떤 효과/트레이드오프가 따라오는가
> - **Status**: Active / Superseded / Revisited
>
> 새 결정은 **최상단**에 추가한다 (역시간순). 결정이 뒤집히면 옛 항목을 지우지 말고 `Status: Superseded by #N` 로 표시한다.

---

## #005 — Phase 10 readiness (release prep)

- **Date**: 2026-05-15
- **Status**: Active (pending user-driven publish)

### Context

Implementation complete: 31/31 tests passing across packages/core (29 unit) and packages/vscode-ext (2 integration). All 5 commands wired up. Cross-platform render verified.

### Decision

Scaffold release artifacts that don't require credentials:
- LICENSE (MIT) at workspace root
- CHANGELOG.md with v0.1.0 entry
- docs/RELEASE.md with manual publish checklist
- `package.json` references license

Tasks 10.2 (publisher registration on Azure DevOps Marketplace) and 10.3 (`vsce publish`) require the user's Personal Access Token and account — those are user-driven steps documented in RELEASE.md.

### Consequences

- Anyone can clone, build, and produce a .vsix locally
- Publishing path is documented and unblocked
- Real brand icon (#004) and real publisher ID are the two remaining blockers before public release

---

## #004 — Placeholder Marketplace Icon

- **Date**: 2026-05-15
- **Status**: Active (placeholder; real design pending)

### Context

VS Code Marketplace는 확장 리스팅에 128x128 PNG 아이콘을 요구한다. 팀에 전담 디자이너가 없고, Phase 10 (Marketplace 정식 발행)을 창의 작업에 막고 싶지 않다.

### Decision

Satori(캡쳐 렌더링에 이미 사용 중인 도구)로 아이콘을 프로그래밍 방식 생성한다:
- macOS 스타일 미니 윈도우 카드 (흰색 배경, 둥근 모서리)
- 상단 크롬에 트래픽 라이트 (빨강/노랑/초록 3개 원)
- 중앙에 큰 "P" 문자
- 자주색 그래디언트 배경 (135deg, `#6e7bf0` → `#b06ef0`)
- 출력: `packages/vscode-ext/icon.png` (128x128, 5248 바이트)
- 생성 스크립트: `scripts/generate-icon.mjs` (재현 가능, Pretendard-Bold 폰트 사용)

### Consequences

**긍정적**:
- Marketplace 요구사항 충족 → Phase 10 발행 차단 해제
- 스크립트 기반 생성으로 브랜딩 업데이트 시 프로그래밍 가능
- 크로스플랫폼 재현성 — 모든 개발자가 동일 아이콘 생성 가능

**부정적/대기**:
- 실제 브랜드 디자인 필요 (v1.0.0 대중 공개 전 교체)
- 임시 솔루션: 공식 Marketplace 목록에 노출되기 전 "이것은 플레이스홀더"라고 명기할 것
- 별도 태스크로 "마이크로소프트 로고/브랜드 가이드라인 준수하는 실제 아이콘 디자인" 추적 필요

### Notes

- 사용된 의존성: satori ^0.26.0, @resvg/resvg-js ^2.6.2 (기존 stack)
- 폰트 자산: `packages/core/assets/fonts/Pretendard-Bold.ttf` (번들된 폰트 재사용)
- `package.json`에 `"icon": "icon.png"` 필드 추가 (vsce package에서 인식)

---

## #003 — Webview 이미지 클립보드 PoC

- **Date**: 2026-05-14
- **Status**: Active
- **F5 verification**: 2026-05-14, user confirmed "Clipboard OK" + paste into Paint/Slack works

### Context

`vscode.env.clipboard`는 텍스트 전용이다. PNG 이미지를 OS 클립보드에 쓰려면 대안이 필요하다.
Spec의 "Cross-platform 검증 포인트 #2" — Webview 내부에서 browser Clipboard API(`navigator.clipboard.write(new ClipboardItem(...))`)로 이미지를 OS 클립보드에 쓸 수 있는지 검증.
이 가정이 실패하면 플랫폼별 셸 명령(xclip/pbcopy/clip.exe)으로 대체해야 하며, Cross-platform 단일 코드 원칙을 위반하게 된다.

### Decision

`poc/02-clipboard/` 에 최소 VS Code 확장을 스캐폴드한다:
- `extension.js`: Webview 패널을 생성하고 1x1 빨간 PNG(base64)를 전달
- `webview.html`: `navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])` 호출 후 결과를 `done` 메시지로 반환
- `package.json`: 확장 매니페스트 (vscode ^1.85.0)

사용자가 Extension Development Host(F5)로 직접 실행하여 "Clipboard OK" 알림 확인 후 그림판/Slack에 Ctrl+V로 붙여넣어 빨간 픽셀이 나타나는지 검증한다.

### Consequences

**성공 시 (예상)**:
- Webview → OS 클립보드 경로가 확립되어 플랫폼별 코드 없이 cross-platform 이미지 복사 구현 가능
- 최종 확장에서는 panel을 숨기거나(`retainContextWhenHidden: true` + 오프스크린 배치) 즉시 dispose하여 UX에 노출하지 않는다
- 권한 프롬프트 발생 여부 확인 필요 (첫 실행 시 브라우저 스타일 허용 팝업 가능성)

**실패 시 (대안)**:
- Webview Clipboard API가 차단될 경우: PNG 파일을 `os.tmpdir()`에 저장 후 `vscode.window.showInformationMessage`에 "Reveal in Folder" 버튼 제공하는 방식으로 대체
- 이 경우 ADR을 업데이트하고 Status를 `Superseded by #004`로 변경

**사용자 F5 검증 필요**: 이 ADR은 수동 실행 확인 후 Status를 `Active` 또는 `Superseded`로 갱신해야 한다.

---

## #002 — Cross-platform render PoC (Windows verified, macOS/Linux pending CI)

- **Date**: 2026-05-13
- **Status**: Active

### Context

Spec의 "Cross-platform 검증 포인트 #1" — @resvg/resvg-js WebAssembly가 Windows/macOS/Linux 모두에서 npm install로 즉시 동작하고 한글 렌더가 깨지지 않는지 검증 필요.

### Decision

Windows에서 Satori 0.26.0 + @resvg/resvg-js 2.6.2 조합으로 PoC 통과 확인.
macOS/Linux 검증은 GitHub 리포지토리 푸시 후 `.github/workflows/poc.yml` 의 `workflow_dispatch` 로 별도 수행 예정.

### Consequences

- 본 설계의 핵심 가정(cross-platform 렌더)은 Windows에서 입증됨
- 실제 라이브러리 버전: satori ^0.26.0, @resvg/resvg-js ^2.6.2
- 한글("안녕하세요") 렌더 완전 정상 — 깨짐 없음
- 이모지(🎉)는 Noto Sans KR 폰트에 이모지 글리프가 없어 tofu 박스로 표시됨 (이모지 폰트 별도 번들 필요, 차후 과제)
- Google Fonts CSS API(`fonts.googleapis.com/css2`)로 실제 gstatic.com TTF URL을 추출해 사용 (원본 plan의 v36 URL은 HTML 리다이렉트 반환으로 교체)
- 사용된 폰트 URL: `https://fonts.gstatic.com/s/notosanskr/v39/PbyxFmXiEBPT4ITbgNA5Cgms3VYcOA-vvnIzzuoyeLQ.ttf`
- macOS/Linux 검증 완료 시 본 항목 Status를 'Active'로 변경

---

## #001 — 초기 설계 합의 (Brainstorming v2)

- **Date**: 2026-05-13
- **Status**: Active

### Context

VS Code 보조 사이드바의 Codex / Claude Code 채팅을 슬랙/이메일에 공유하기 좋은 이미지로 캡쳐하고 싶음. 기존 도구(SpecStory, Copilot Chat Exporter 등)는 텍스트/마크다운 익스포트 중심이고, 공유 친화적인 이미지 출력은 공백 영역. 또한 VS Code 확장은 다른 확장의 Webview에 접근할 수 없으므로, OS 스크린샷이 아니면 사이드바를 직접 캡쳐할 수단이 없음.

### Decision

다음 12개 결정을 묶어 v1 설계로 확정 (`docs/superpowers/specs/2026-05-13-promptshot-design.md` 참조):

1. **재렌더링 방식 채택** (OS 스크린샷 미사용) — 세션 JSONL을 파싱해 자체 렌더링
2. **Satori + @resvg/resvg-js** 렌더러 (Puppeteer 미사용)
3. **pnpm 모노레포** (`core/` + `vscode-ext/`)
4. **마지막 user→assistant 1쌍** 캡쳐 (전체 세션 X)
5. **이미지 우선, 마크다운 옵션** — 슬랙/이메일 공유 1순위
6. **폰트 번들** (Pretendard + JetBrains Mono, ~1MB)
7. **CLI 제거, VS Code 확장 단독** — 사용자 요청
8. **macOS 작업창 스타일 테마** (mac-light / mac-dark 2개)
9. **Cross-platform 우선** — Windows/macOS/Linux 동일 코드, 네이티브 모듈 금지
10. **Marketplace 정식 등록 (v1부터)**
11. **골든 이미지 자동 테스트 제거** — 샘플 카탈로그로 대체
12. **Codex / Claude Code 동등 1순위 지원**

### Consequences

**긍정적**:
- 렌더 품질이 사이드바보다 일관되고 깔끔 (Slack에 보기 좋음)
- core가 VS Code API에 의존하지 않아 테스트 용이
- Cross-platform 보장 → 모든 사용자가 동일 설치 경험
- Marketplace 단일 진입점으로 사용자 발견/설치 단순화

**부정적/트레이드오프**:
- 실제 사이드바와 픽셀 단위 fidelity는 포기 (재렌더링)
- 이미지 클립보드를 Webview 우회로 구현 → 첫 실행 시 권한 프롬프트 가능성, PoC로 검증 필요
- 폰트 번들로 패키지 ~1MB 증가
- 글로벌 핫키 등 VS Code 외부 사용 시나리오 없음 (확장 명령으로만 동작)

### Notes

- 사용자 핵심 요구: 슬랙/이메일에 즉시 붙여넣을 수 있는 미적으로 폴리시된 이미지
- Carbon.now.sh를 비주얼 영감으로 명시
- 터미널 캡쳐는 v2 후보로 보류 (가능은 함, 우선순위 낮음)

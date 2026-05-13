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

## #002 — Cross-platform render PoC (Windows verified, macOS/Linux pending CI)

- **Date**: 2026-05-13
- **Status**: Active (partial)

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

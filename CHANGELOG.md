# Changelog

All notable changes to Promptshot will be documented here.

## [0.1.1] — 2026-05-18

### Added
- `Promptshot: Pick Session…` is now a two-stage picker: choose a session, then choose output format (PNG / Markdown). This lets you capture exchanges other than the most recent one.
- `selectLatestExchange` accepts `sessionPath` to force a specific session file (used internally by Pick Session).

### Fixed
- `promptshot.maxHeight` setting now actually works. Previously declared but unused; very long messages would render into enormous PNGs. Now content is truncated with a "(N more chars)" footer when the message length exceeds an approximate budget derived from maxHeight.

## [0.1.0] — 2026-05-18

Initial release.

### Added
- Capture last user → AI exchange from Codex (`~/.codex/sessions/`) and Claude Code (`~/.claude/projects/`)
- Five commands: `captureLastExchange`, `captureAsMarkdown`, `pickSession`, `chooseTheme`, `openLastCapture`
- Default keybinding `Ctrl+Alt+P` (Mac: `Cmd+Alt+P`)
- Two themes: `mac-light` and `mac-dark` (macOS-styled window chrome)
- Cross-platform: Windows / macOS / Linux (no native modules, all WebAssembly + browser APIs)
- Image clipboard via hidden Webview (browser Clipboard API)
- Markdown clipboard mode
- File save to `~/Pictures/Promptshot/` with timestamp filenames + collision suffixes
- Auto-redaction for OpenAI / GitHub / JWT / AWS / Google secrets
- Bundled Pretendard + JetBrains Mono fonts (no system font dependency)
- 7 user-configurable settings

### Known limitations
- Placeholder Marketplace icon (real design pending)
- Cursor and GitHub Copilot Chat not supported (v2)
- Terminal capture not supported (v2)
- Codex / Claude Code JSONL schemas are reverse-engineered; upstream changes could break parsers
- The hidden Webview briefly flashes during image clipboard write
- `pickSession` v1 falls back to the latest session (explicit session pick is v1.1)

# Promptshot — Beautiful AI Chat Captures

Capture VS Code's secondary-sidebar AI chat (Codex / Claude Code) as shareable PNG images or clean markdown — in one keystroke.

> Press `Ctrl+Alt+P` (Mac: `Cmd+Alt+P`) on the last user→AI exchange. The macOS-styled image lands on your clipboard, ready to paste into Slack, email, or anywhere.

## Features

- **One keystroke** to capture the last user → AI exchange
- **macOS-styled** window chrome with traffic lights
- **Cross-platform** — Windows / macOS / Linux (no native modules)
- **Two formats** — PNG (image clipboard + file) or clean markdown
- **Two themes** — `mac-light` and `mac-dark`
- **Auto-redaction** for API keys, GitHub tokens, JWTs, AWS / Google keys
- **Two AI sources** — Codex and Claude Code (auto-detect latest, or pin)

## Commands

| Command | Default keybinding |
|---|---|
| Promptshot: Capture Last Exchange | `Ctrl+Alt+P` / `Cmd+Alt+P` |
| Promptshot: Capture as Markdown | (Command Palette) |
| Promptshot: Pick Session… | (Command Palette) |
| Promptshot: Choose Theme… | (Command Palette) |
| Promptshot: Open Last Capture | (Command Palette) |

## Settings

| Setting | Default | Notes |
|---|---|---|
| `promptshot.theme` | `mac-light` | `mac-light` or `mac-dark` |
| `promptshot.source` | `auto` | `auto`, `codex`, or `claude-code` |
| `promptshot.outputDir` | (empty → `~/Pictures/Promptshot`) | Save folder for PNGs |
| `promptshot.width` | `720` | Image width (px) |
| `promptshot.maxHeight` | `4000` | Truncate very long messages |
| `promptshot.includeTools` | `false` | Include tool_use messages |
| `promptshot.includeSystem` | `false` | Include system messages |

## How it works

Reads the most recent JSONL session log from `~/.codex/sessions/` or `~/.claude/projects/`, extracts the last user→AI exchange, and renders it via Satori + resvg-js into a PNG. Image clipboard uses a hidden Webview with the browser Clipboard API — fully cross-platform.

## License

MIT

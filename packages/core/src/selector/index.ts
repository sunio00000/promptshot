import { stat } from 'node:fs/promises'
import { CodexSource } from '../sources/codex.js'
import { ClaudeCodeSource } from '../sources/claude-code.js'
import type { Exchange, SourceId, SessionFile } from '../types.js'

export type SelectOptions = {
  source?: SourceId | 'auto'
  sessionId?: string
  sessionPath?: string         // 지정 시 해당 JSONL 파일을 직접 파싱
  workspaceHint?: string
  codexRoot?: string
  claudeProjectsRoot?: string
}

export async function selectLatestExchange(opts: SelectOptions = {}): Promise<Exchange | null> {
  const codex = new CodexSource({ rootDir: opts.codexRoot })
  const claude = new ClaudeCodeSource({ projectsDir: opts.claudeProjectsRoot })

  // sessionPath가 지정된 경우 해당 파일을 직접 파싱
  if (opts.sessionPath) {
    const s = await stat(opts.sessionPath).catch(() => null)
    if (!s) throw new Error(`Session file not found: ${opts.sessionPath}`)
    const file: SessionFile = { path: opts.sessionPath, mtime: s.mtime }
    const normalized = opts.sessionPath.replace(/\\/g, '/')
    if (normalized.includes('/.codex/sessions/') || normalized.includes('/codex/')) {
      return codex.parseLastExchange(file)
    }
    if (normalized.includes('/.claude/projects/') || normalized.includes('/claude-code/')) {
      return claude.parseLastExchange(file)
    }
    // 경로 추론 불가 시 양쪽 모두 시도해서 최초 non-null 반환
    return (await codex.parseLastExchange(file)) ?? (await claude.parseLastExchange(file))
  }

  const source = opts.source ?? 'auto'

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

  // auto: 가장 최근에 수정된 파일이 있는 source 선택
  const [codexFiles, claudeFiles] = await Promise.all([
    codex.discoverSessions(),
    claude.discoverSessions()
  ])
  type Candidate = { src: CodexSource | ClaudeCodeSource; file: SessionFile }
  const candidates: Candidate[] = []
  if (codexFiles[0]) candidates.push({ src: codex, file: codexFiles[0] })
  if (claudeFiles[0]) candidates.push({ src: claude, file: claudeFiles[0] })
  if (candidates.length === 0) throw new Error('no AI sessions found in Codex or Claude Code')

  candidates.sort((a, b) => b.file.mtime.getTime() - a.file.mtime.getTime())
  return candidates[0].src.parseLastExchange(candidates[0].file)
}

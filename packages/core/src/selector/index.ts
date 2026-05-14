import { CodexSource } from '../sources/codex.js'
import { ClaudeCodeSource } from '../sources/claude-code.js'
import type { Exchange, SourceId, SessionFile } from '../types.js'

export type SelectOptions = {
  source?: SourceId | 'auto'
  sessionId?: string
  workspaceHint?: string
  codexRoot?: string
  claudeProjectsRoot?: string
}

export async function selectLatestExchange(opts: SelectOptions = {}): Promise<Exchange | null> {
  const source = opts.source ?? 'auto'
  const codex = new CodexSource({ rootDir: opts.codexRoot })
  const claude = new ClaudeCodeSource({ projectsDir: opts.claudeProjectsRoot })

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

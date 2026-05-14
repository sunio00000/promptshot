import { readdir, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { homedir } from 'node:os'
import type { ChatSource } from './types.js'
import type { Exchange, SessionFile } from '../types.js'

type Event = { role: 'user' | 'assistant'; content: string }

export class ClaudeCodeSource implements ChatSource {
  readonly id = 'claude-code' as const
  readonly label = 'Claude Code'
  private readonly projectsDir: string

  constructor(opts?: { projectsDir?: string }) {
    this.projectsDir = opts?.projectsDir ?? join(homedir(), '.claude', 'projects')
  }

  async discoverSessions(): Promise<SessionFile[]> {
    const files: SessionFile[] = []
    await this.walk(this.projectsDir, files)
    files.sort((a, b) => b.mtime.getTime() - a.mtime.getTime())
    return files
  }

  private async walk(dir: string, out: SessionFile[]): Promise<void> {
    let entries
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      const p = join(dir, e.name)
      if (e.isDirectory()) {
        if (e.name === 'subagents') continue  // 메인 채팅만 (subagent 제외)
        await this.walk(p, out)
      } else if (e.isFile() && e.name.endsWith('.jsonl')) {
        const s = await stat(p)
        out.push({ path: p, mtime: s.mtime })
      }
    }
  }

  async parseLastExchange(file: SessionFile): Promise<Exchange | null> {
    const text = await readFile(file.path, 'utf8')
    const lines = text.split('\n').filter(Boolean)
    const events: Event[] = []

    for (const line of lines) {
      let obj: unknown
      try {
        obj = JSON.parse(line)
      } catch {
        // truncated 마지막 라인 무시
        continue
      }
      const ev = toUserAssistantEvent(obj)
      if (ev) events.push(ev)
    }

    const lastAssistantIdx = findLastIndex(events, e => e.role === 'assistant')
    if (lastAssistantIdx === -1) return null
    const lastUserIdx = findLastIndex(events.slice(0, lastAssistantIdx), e => e.role === 'user')
    if (lastUserIdx === -1) return null

    return {
      source: 'claude-code',
      sourceLabel: 'Claude Code',
      sessionId: file.path.split(/[\\/]/).pop()!.replace(/\.jsonl$/, ''),
      sessionPath: file.path,
      timestamp: file.mtime,
      user: { content: events[lastUserIdx].content },
      assistant: { content: events[lastAssistantIdx].content },
    }
  }
}

// 실제 Claude Code JSONL 스키마:
//   { type: 'user'|'assistant'|'attachment'|'file-history-snapshot',
//     isSidechain?: boolean, isMeta?: boolean,
//     message: { role: 'user'|'assistant', content: string | Array<{type, text?, ...}> } }
//
// 추출 규칙:
// - type이 'user' 또는 'assistant'인 경우만 처리
// - isSidechain === true 이면 제외 (subagent 실행)
// - isMeta === true 이면 제외 (hook/system 메시지)
// - user: message.content가 string 또는 배열 (text 블록)
// - assistant: message.content는 배열; 'text' 블록만 추출 (tool_use, thinking 등 제외)
function toUserAssistantEvent(obj: unknown): Event | null {
  if (!obj || typeof obj !== 'object') return null
  const o = obj as Record<string, unknown>

  const type = o.type
  if (type !== 'user' && type !== 'assistant') return null

  if (o.isSidechain === true) return null
  if (o.isMeta === true) return null

  const msg = o.message as Record<string, unknown> | undefined
  if (!msg) return null

  const role = msg.role
  if (role !== 'user' && role !== 'assistant') return null
  if (role !== type) return null  // type과 role이 일치해야 함 (sanity check)

  const content = msg.content
  let text: string
  if (typeof content === 'string') {
    text = content
  } else if (Array.isArray(content)) {
    text = content
      .filter((b): b is { type: string; text?: string } =>
        !!b && typeof b === 'object' && (b as Record<string, unknown>).type === 'text')
      .map(b => b.text ?? '')
      .join('\n')
  } else {
    return null
  }

  if (!text) return null
  return { role, content: text }
}

// findLastIndex polyfill (ES2023; 빌드 타겟은 ES2022)
function findLastIndex<T>(arr: readonly T[], pred: (v: T) => boolean): number {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (pred(arr[i])) return i
  }
  return -1
}

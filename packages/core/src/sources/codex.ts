import { readdir, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { homedir } from 'node:os'
import type { ChatSource } from './types.js'
import type { Exchange, SessionFile } from '../types.js'

type CodexEvent = { role: 'user' | 'assistant'; content: string }

/** 배열에서 마지막 일치 인덱스를 반환 (findLastIndex polyfill) */
function findLastIndex<T>(arr: T[], predicate: (item: T) => boolean): number {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (predicate(arr[i])) return i
  }
  return -1
}

export class CodexSource implements ChatSource {
  readonly id = 'codex' as const
  readonly label = 'Codex'
  private readonly rootDir: string

  constructor(opts?: { rootDir?: string }) {
    this.rootDir = opts?.rootDir ?? join(homedir(), '.codex', 'sessions')
  }

  async discoverSessions(): Promise<SessionFile[]> {
    const files: SessionFile[] = []
    await this.walk(this.rootDir, files)
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
    const events: CodexEvent[] = []

    for (const line of lines) {
      let obj: unknown
      try {
        obj = JSON.parse(line)
      } catch {
        // 마지막 truncated 라인 무시
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
      source: 'codex',
      sourceLabel: 'Codex',
      sessionId: file.path.split(/[\\/]/).pop()!.replace(/\.jsonl$/, ''),
      sessionPath: file.path,
      timestamp: file.mtime,
      user: { content: events[lastUserIdx].content },
      assistant: { content: events[lastAssistantIdx].content },
    }
  }
}

// 실제 Codex JSONL 스키마:
//   { type: 'response_item', payload: { type: 'message', role: 'user'|'assistant'|'developer',
//     content: [{ type: 'input_text'|'output_text', text: string }], phase?: 'commentary'|'final_answer' } }
// role=user/assistant 만 추출하고 input_text/output_text 블록을 합친다.
// assistant의 경우 phase==='final_answer'만 수용 (중간 commentary 제외).
function toUserAssistantEvent(obj: unknown): CodexEvent | null {
  if (!obj || typeof obj !== 'object') return null
  const o = obj as Record<string, unknown>
  if (o.type !== 'response_item') return null
  const payload = o.payload as Record<string, unknown> | undefined
  if (!payload || payload.type !== 'message') return null

  const role = payload.role
  if (role !== 'user' && role !== 'assistant') return null

  // assistant는 최종 답변만 수용 (중간 commentary 제외)
  if (role === 'assistant' && payload.phase !== undefined && payload.phase !== 'final_answer') return null

  const blocks = payload.content
  if (!Array.isArray(blocks)) return null
  const expectedBlockType = role === 'user' ? 'input_text' : 'output_text'
  const text = blocks
    .filter((b): b is { type: string; text?: string } =>
      !!b && typeof b === 'object' && (b as { type?: unknown }).type === expectedBlockType)
    .map(b => b.text ?? '')
    .join('\n')

  if (!text) return null
  return { role, content: text }
}

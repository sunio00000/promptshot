import { describe, it, expect } from 'vitest'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CodexSource } from '../../src/sources/codex.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const fx = (name: string) => resolve(__dirname, '../fixtures/codex', name)

describe('CodexSource', () => {
  const source = new CodexSource({ rootDir: resolve(__dirname, '../fixtures/codex') })

  it('id and label', () => {
    expect(source.id).toBe('codex')
    expect(source.label).toBe('Codex')
  })

  it('discoverSessions returns mtime-sorted jsonl files', async () => {
    const files = await source.discoverSessions()
    expect(files.length).toBeGreaterThan(0)
    expect(files.every(f => f.path.endsWith('.jsonl'))).toBe(true)
    for (let i = 1; i < files.length; i++) {
      expect(files[i - 1].mtime.getTime()).toBeGreaterThanOrEqual(files[i].mtime.getTime())
    }
  })

  it('parseLastExchange returns last user-assistant pair from normal fixture', async () => {
    const file = { path: fx('normal.jsonl'), mtime: new Date() }
    const ex = await source.parseLastExchange(file)
    expect(ex).not.toBeNull()
    expect(ex!.source).toBe('codex')
    expect(ex!.sourceLabel).toBe('Codex')
    expect(ex!.user.content).toBeTruthy()
    expect(ex!.assistant.content).toBeTruthy()
  })

  it('parseLastExchange ignores truncated last line', async () => {
    const file = { path: fx('truncated.jsonl'), mtime: new Date() }
    const ex = await source.parseLastExchange(file)
    expect(ex).not.toBeNull()  // 그 전까지로 파싱
  })

  it('parseLastExchange returns null when no assistant response yet', async () => {
    const file = { path: fx('no-assistant.jsonl'), mtime: new Date() }
    const ex = await source.parseLastExchange(file)
    expect(ex).toBeNull()
  })
})

import { describe, it, expect } from 'vitest'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ClaudeCodeSource } from '../../src/sources/claude-code.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const fx = (name: string) => resolve(__dirname, '../fixtures/claude-code', name)

describe('ClaudeCodeSource', () => {
  const source = new ClaudeCodeSource({ projectsDir: resolve(__dirname, '../fixtures/claude-code') })

  it('id and label', () => {
    expect(source.id).toBe('claude-code')
    expect(source.label).toBe('Claude Code')
  })

  it('ignores subagent jsonl files in discovery', async () => {
    const files = await source.discoverSessions()
    expect(files.length).toBeGreaterThan(0)
    expect(files.every(f => !f.path.includes('subagents'))).toBe(true)
  })

  it('parseLastExchange returns user-assistant pair from normal fixture', async () => {
    const file = { path: fx('normal.jsonl'), mtime: new Date() }
    const ex = await source.parseLastExchange(file)
    expect(ex).not.toBeNull()
    expect(ex!.source).toBe('claude-code')
    expect(ex!.sourceLabel).toBe('Claude Code')
    expect(ex!.user.content).toBeTruthy()
    expect(ex!.assistant.content).toBeTruthy()
  })

  it('returns null when no assistant response', async () => {
    const file = { path: fx('no-assistant.jsonl'), mtime: new Date() }
    const ex = await source.parseLastExchange(file)
    expect(ex).toBeNull()
  })
})

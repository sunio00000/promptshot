import { describe, it, expect, beforeAll } from 'vitest'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { utimes } from 'node:fs/promises'
import { selectLatestExchange } from '../src/selector/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const codexDir = resolve(__dirname, 'fixtures/codex')
const claudeDir = resolve(__dirname, 'fixtures/claude-code')

beforeAll(async () => {
  // discoverSessions()가 normal.jsonl을 가장 최신으로 선택하도록 mtime을 강제로 설정한다.
  // normal.jsonl은 "현재", no-assistant.jsonl/truncated.jsonl은 "현재 - 1분"으로 설정.
  const now = new Date()
  const past = new Date(now.getTime() - 60_000)
  await utimes(join(codexDir, 'normal.jsonl'), now, now)
  await utimes(join(codexDir, 'truncated.jsonl'), past, past)
  await utimes(join(codexDir, 'no-assistant.jsonl'), past, past)
  await utimes(join(claudeDir, 'normal.jsonl'), now, now)
  await utimes(join(claudeDir, 'no-assistant.jsonl'), past, past)
})

describe('selectLatestExchange', () => {
  it('auto picks the more recently modified source', async () => {
    const ex = await selectLatestExchange({
      source: 'auto',
      codexRoot: codexDir,
      claudeProjectsRoot: claudeDir
    })
    expect(ex).not.toBeNull()
    expect(['codex', 'claude-code']).toContain(ex!.source)
  })

  it('source: codex returns codex result', async () => {
    const ex = await selectLatestExchange({
      source: 'codex',
      codexRoot: codexDir,
      claudeProjectsRoot: claudeDir
    })
    expect(ex!.source).toBe('codex')
  })

  it('source: claude-code returns claude-code result', async () => {
    const ex = await selectLatestExchange({
      source: 'claude-code',
      codexRoot: codexDir,
      claudeProjectsRoot: claudeDir
    })
    expect(ex!.source).toBe('claude-code')
  })

  it('source: codex throws when codex has no sessions', async () => {
    await expect(
      selectLatestExchange({ source: 'codex', codexRoot: '/nonexistent/promptshot-test', claudeProjectsRoot: claudeDir })
    ).rejects.toThrow(/no Codex sessions/i)
  })
})

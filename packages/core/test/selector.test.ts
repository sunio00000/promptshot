import { describe, it, expect } from 'vitest'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { selectLatestExchange } from '../src/selector/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const codexDir = resolve(__dirname, 'fixtures/codex')
const claudeDir = resolve(__dirname, 'fixtures/claude-code')

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

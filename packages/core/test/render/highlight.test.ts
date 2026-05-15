import { describe, it, expect } from 'vitest'
import { highlightCode } from '../../src/render/highlight.js'

describe('highlightCode', () => {
  it('returns token list with color for typescript', async () => {
    const lines = await highlightCode('const x = 1', 'ts', 'github-light')
    expect(lines.length).toBeGreaterThan(0)
    expect(lines[0][0].content).toContain('const')
    expect(lines[0][0].color).toMatch(/^#/)
  })

  it('returns plain tokens for unknown language', async () => {
    const lines = await highlightCode('hello', 'unknown-lang', 'github-light')
    expect(lines.length).toBeGreaterThan(0)
  })
})

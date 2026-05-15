import { describe, it, expect } from 'vitest'
import { renderExchange } from '../../src/render/index.js'
import { macLight } from '../../src/theme/mac-light.js'
import type { Exchange } from '../../src/types.js'

const sample: Exchange = {
  source: 'codex',
  sourceLabel: 'Codex',
  sessionId: 'test',
  sessionPath: '/tmp/test.jsonl',
  timestamp: new Date(),
  user: { content: '안녕! 코드 예시 좀.' },
  assistant: { content: '```ts\nconst x = 1\n```\n\n**Bold** and `inline`.' }
}

describe('renderExchange', () => {
  it('produces a valid PNG buffer', async () => {
    const png = await renderExchange(sample, macLight, { width: 720 })
    expect(Buffer.isBuffer(png)).toBe(true)
    // PNG 매직 바이트: 89 50 4E 47
    expect(png.subarray(0, 4).toString('hex')).toBe('89504e47')
    expect(png.length).toBeGreaterThan(1000)
  }, 30000)
})

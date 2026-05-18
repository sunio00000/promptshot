import { describe, it, expect } from 'vitest'
import { renderExchange, __test__ } from '../../src/render/index.js'
import { macLight } from '../../src/theme/mac-light.js'
import type { Exchange } from '../../src/types.js'

const { applyMaxHeight } = __test__

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

describe('renderExchange with maxHeight', () => {
  const makeLong = (chars: number) => 'a'.repeat(chars)

  it('truncates very long assistant content', async () => {
    const ex: Exchange = {
      source: 'codex', sourceLabel: 'Codex',
      sessionId: 't', sessionPath: '/t', timestamp: new Date(),
      user: { content: 'short question' },
      assistant: { content: makeLong(50000) }
    }
    // maxHeight가 낮으면 truncation이 발생하고 PNG가 정상 생성되어야 함
    const png = await renderExchange(ex, macLight, { width: 720, maxHeight: 1000 })
    expect(Buffer.isBuffer(png)).toBe(true)
    expect(png.length).toBeGreaterThan(1000)
  }, 30000)

  it('preserves short content', async () => {
    const ex: Exchange = {
      source: 'codex', sourceLabel: 'Codex',
      sessionId: 't', sessionPath: '/t', timestamp: new Date(),
      user: { content: 'short' },
      assistant: { content: 'also short' }
    }
    const png = await renderExchange(ex, macLight, { width: 720, maxHeight: 4000 })
    expect(Buffer.isBuffer(png)).toBe(true)
  }, 30000)
})

describe('applyMaxHeight', () => {
  const mk = (u: string, a: string): Exchange => ({
    source: 'codex', sourceLabel: 'Codex',
    sessionId: 't', sessionPath: '/t', timestamp: new Date(),
    user: { content: u },
    assistant: { content: a }
  })

  it('passes through when under budget', () => {
    const ex = mk('short', 'also short')
    expect(applyMaxHeight(ex, 4000)).toBe(ex)  // 동일 참조
  })

  it('truncates assistant when over budget', () => {
    const ex = mk('hi', 'a'.repeat(50000))
    const result = applyMaxHeight(ex, 1000)
    expect(result.assistant.content.length).toBeLessThan(5000)
    expect(result.assistant.content).toMatch(/truncated/)
  })

  it('keeps original when maxHeight is undefined', () => {
    const ex = mk('hi', 'a'.repeat(50000))
    const result = applyMaxHeight(ex, undefined)
    expect(result).toBe(ex)
  })
})

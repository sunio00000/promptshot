import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { __test__ } from '../../src/render/index.js'

const { formatRel } = __test__

describe('formatRel', () => {
  const NOW = new Date('2026-05-22T14:30:00Z').getTime()

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  function ago(ms: number): Date {
    return new Date(NOW - ms)
  }

  it('renders seconds with "sec ago"', () => {
    expect(formatRel(ago(5_000))).toBe('5 sec ago')
    expect(formatRel(ago(0))).toBe('0 sec ago')
  })

  it('renders minutes with "min ago"', () => {
    expect(formatRel(ago(60_000))).toBe('1 min ago')
    expect(formatRel(ago(5 * 60_000))).toBe('5 min ago')
    expect(formatRel(ago(59 * 60_000))).toBe('59 min ago')
  })

  it('renders hours with "hr ago"', () => {
    expect(formatRel(ago(60 * 60_000))).toBe('1 hr ago')
    expect(formatRel(ago(3 * 60 * 60_000))).toBe('3 hr ago')
  })

  it('uses singular "day" for exactly 1 day, "days" otherwise', () => {
    const day = 24 * 60 * 60_000
    expect(formatRel(ago(day))).toBe('1 day ago')
    expect(formatRel(ago(2 * day))).toBe('2 days ago')
    expect(formatRel(ago(30 * day))).toBe('30 days ago')
  })

  it('does not produce Korean output', () => {
    const samples = [
      formatRel(ago(5_000)),
      formatRel(ago(5 * 60_000)),
      formatRel(ago(3 * 60 * 60_000)),
      formatRel(ago(2 * 24 * 60 * 60_000))
    ]
    for (const out of samples) {
      expect(out).not.toMatch(/[가-힣]/)
    }
  })
})

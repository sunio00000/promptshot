import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { saveImageToFile } from '../src/output/index.js'

describe('saveImageToFile', () => {
  let dir: string
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'promptshot-'))
  })
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('saves PNG to given directory with timestamp-based name', async () => {
    const buf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    const path = await saveImageToFile(buf, dir)
    expect(existsSync(path)).toBe(true)
    expect(path).toMatch(/\.png$/)
  })

  it('suffixes _2, _3 on collision', async () => {
    const buf = Buffer.from([0x89, 0x50, 0x4e, 0x47])
    const fixedNow = new Date(2026, 4, 13, 14, 30, 0)
    const p1 = await saveImageToFile(buf, dir, { now: fixedNow })
    const p2 = await saveImageToFile(buf, dir, { now: fixedNow })
    expect(p1).not.toBe(p2)
    expect(p2).toMatch(/_2\.png$/)
  })

  it('creates directory if it does not exist', async () => {
    const buf = Buffer.from([0x89, 0x50, 0x4e, 0x47])
    const newDir = join(dir, 'nested', 'deep')
    const path = await saveImageToFile(buf, newDir)
    expect(existsSync(path)).toBe(true)
  })
})

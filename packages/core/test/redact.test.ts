import { describe, it, expect } from 'vitest'
import { redactSecrets } from '../src/redact/index.js'

describe('redactSecrets', () => {
  it('masks OpenAI sk- keys', () => {
    const { text, hits } = redactSecrets('use this: sk-abc123def456ghi789jkl012mno345pqr678stuv')
    expect(text).not.toContain('sk-abc123')
    expect(text).toMatch(/sk-\*{3,}/)
    expect(hits).toContain('openai')
  })

  it('masks GitHub tokens', () => {
    const { text, hits } = redactSecrets('token ghp_1234567890abcdef1234567890abcdef12345678')
    expect(text).not.toContain('ghp_1234567890abcdef')
    expect(hits).toContain('github')
  })

  it('masks JWT', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NSJ9.SflKxwRJ'
    const { text, hits } = redactSecrets('Authorization: Bearer ' + jwt)
    expect(text).not.toContain(jwt)
    expect(hits).toContain('jwt')
  })

  it('preserves non-secret text', () => {
    const { text, hits } = redactSecrets('hello world, no secrets here')
    expect(text).toBe('hello world, no secrets here')
    expect(hits).toEqual([])
  })
})

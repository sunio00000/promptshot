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

  it('masks Anthropic sk-ant- keys (and labels as anthropic, not openai)', () => {
    const { text, hits } = redactSecrets('use claude: sk-ant-FAKEDEMONOTAREALANTHROPICKEY')
    expect(text).not.toContain('sk-ant-FAKEDEMONOTAREAL')
    expect(text).toMatch(/sk-\*{3,}/)
    expect(hits).toContain('anthropic')
    expect(hits).not.toContain('openai')
  })

  it('masks Slack tokens (bot / user / app variants)', () => {
    const r1 = redactSecrets('xoxb-FAKE-DEMO-NOT-A-REAL-SLACK-TOKEN-A')
    expect(r1.hits).toContain('slack')
    expect(r1.text).not.toContain('NOT-A-REAL-SLACK-TOKEN')

    const r2 = redactSecrets('xoxp-FAKE-DEMO-NOT-A-REAL-SLACK-TOKEN-B')
    expect(r2.hits).toContain('slack')

    const r3 = redactSecrets('xapp-FAKE-DEMO-NOT-A-REAL-SLACK-TOKEN-C')
    expect(r3.hits).toContain('slack')
  })

  it('masks Stripe live/test/restricted keys', () => {
    // Tokens are assembled at runtime so the literal string never appears in source —
    // otherwise GitHub Secret Scanning blocks the push.
    const fake = 'FAKE' + 'demonotreal' + 'stripekey00'  // 26 chars, low entropy
    const samples = [
      ['sk', 'live', fake + 'A'].join('_'),
      ['sk', 'test', fake + 'B'].join('_'),
      ['pk', 'live', fake + 'C'].join('_'),
      ['pk', 'test', fake + 'D'].join('_'),
      ['rk', 'live', fake + 'E'].join('_')
    ]
    for (const sample of samples) {
      const { text, hits } = redactSecrets(sample)
      expect(hits).toContain('stripe')
      expect(text).not.toContain(sample)
    }
  })

  it('masks PEM private key blocks (multiline)', () => {
    const pem = [
      '-----BEGIN RSA PRIVATE KEY-----',
      'MIIEowIBAAKCAQEA1234567890abcdef',
      'fakepayloadfakepayloadfakepayload',
      '-----END RSA PRIVATE KEY-----'
    ].join('\n')
    const { text, hits } = redactSecrets(`my key: ${pem}`)
    expect(hits).toContain('private_key')
    expect(text).not.toContain('fakepayloadfakepayloadfakepayload')
    expect(text).not.toContain('-----END RSA PRIVATE KEY-----')
  })

  it('masks PEM blocks for OpenSSH / EC / generic PRIVATE KEY variants', () => {
    const variants = [
      '-----BEGIN OPENSSH PRIVATE KEY-----\nABC\n-----END OPENSSH PRIVATE KEY-----',
      '-----BEGIN EC PRIVATE KEY-----\nXYZ\n-----END EC PRIVATE KEY-----',
      '-----BEGIN PRIVATE KEY-----\nQRS\n-----END PRIVATE KEY-----'
    ]
    for (const v of variants) {
      const { hits } = redactSecrets(v)
      expect(hits).toContain('private_key')
    }
  })

  it('masks database URLs with credentials', () => {
    const urls = [
      'postgres://user:secretpass@db.example.com:5432/mydb',
      'postgresql://admin:p%40ssw0rd@host/db',
      'mysql://root:mysecret@localhost:3306/test',
      'mongodb://user:pw@cluster.example.com/db',
      'mongodb+srv://user:pw@cluster.mongodb.net/db'
    ]
    for (const url of urls) {
      const { text, hits } = redactSecrets(`conn: ${url}`)
      expect(hits).toContain('db_url')
      expect(text).not.toContain('secretpass')
      expect(text).not.toContain('p%40ssw0rd')
      expect(text).not.toContain('mysecret')
    }
  })

  it('masks generic Bearer tokens (non-JWT)', () => {
    const { text, hits } = redactSecrets('Authorization: Bearer abc123def456ghi789jkl012MNO')
    expect(hits).toContain('bearer')
    expect(text).not.toContain('abc123def456ghi789jkl012MNO')
  })
})

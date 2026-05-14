import { PATTERNS } from './patterns.js'

export function redactSecrets(text: string): { text: string; hits: string[] } {
  const hits: string[] = []
  let out = text
  for (const p of PATTERNS) {
    if (p.regex.test(out)) {
      hits.push(p.name)
      out = out.replace(p.regex, (m) => m.slice(0, 3) + '*'.repeat(Math.max(3, m.length - 3)))
    }
    p.regex.lastIndex = 0  // reset global regex state
  }
  return { text: out, hits }
}

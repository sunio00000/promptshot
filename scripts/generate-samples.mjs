import { writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

const coreEntryPath = join(root, 'packages/core/dist/index.js')
const core = await import(pathToFileURL(coreEntryPath).href)

const samples = {
  short:   { user: 'Hi!', assistant: 'Hello! How can I help?' },
  code:    { user: 'Show me a TypeScript one-liner', assistant: '```ts\nconst x: number = 1\nconsole.log(x)\n```' },
  table:   { user: 'Give me a small table', assistant: '| Item | Value |\n|---|---|\n| 1 | A |\n| 2 | B |' },
  longish: { user: 'Give me a longer answer with formatting', assistant: '## Heading\n\n- First point\n- Second point\n- Third point\n\n**Bold** and *italic* and `inline code`.' }
}

const outDir = join(root, 'docs/samples')
mkdirSync(outDir, { recursive: true })

for (const themeName of ['mac-light', 'mac-dark']) {
  const theme = core.getTheme(themeName)
  for (const [name, msgs] of Object.entries(samples)) {
    const ex = {
      source: 'codex',
      sourceLabel: 'Codex',
      sessionId: 'sample',
      sessionPath: '/sample',
      timestamp: new Date(),
      user: { content: msgs.user },
      assistant: { content: msgs.assistant }
    }
    const png = await core.renderExchange(ex, theme, { width: 720 })
    const out = join(outDir, `${themeName}-${name}.png`)
    writeFileSync(out, png)
    console.log('wrote', out, png.length, 'bytes')
  }
}
console.log('done')

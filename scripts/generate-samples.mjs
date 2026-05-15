import { writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

const coreEntryPath = join(root, 'packages/core/dist/index.js')
const core = await import(pathToFileURL(coreEntryPath).href)

const samples = {
  short:   { user: '안녕!', assistant: '안녕하세요.' },
  code:    { user: 'TypeScript 한 줄 예시', assistant: '```ts\nconst x: number = 1\nconsole.log(x)\n```' },
  table:   { user: '간단한 표 좀', assistant: '| 항목 | 값 |\n|---|---|\n| 1 | 가 |\n| 2 | 나 |' },
  longish: { user: '긴 답변 좀 줘', assistant: '## 헤딩\n\n- 한 줄\n- 두 줄\n- 세 줄\n\n**굵은 글씨**와 *기울임* 그리고 `인라인 코드`.' }
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

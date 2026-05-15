import { build } from 'esbuild'
import { copyFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const ENTRY = join(__dirname, 'src/extension.ts')
const OUT = join(__dirname, 'dist/extension.js')

// esbuild로 번들링 — vscode만 외부(runtime 제공)로 제외
// CJS 포맷에서 import.meta.url 이 동작하도록 banner로 폴리필 주입
await build({
  entryPoints: [ENTRY],
  outfile: OUT,
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  external: ['vscode'],
  minify: false,
  sourcemap: true,
  // import.meta.url → CJS에서 __filename 기반으로 대체
  define: {
    'import.meta.url': '__importMetaUrl'
  },
  banner: {
    js: [
      '// import.meta.url CJS 폴리필',
      "const __importMetaUrl = require('url').pathToFileURL(__filename).href;"
    ].join('\n')
  },
  loader: {}
})

// webview.html 복사
mkdirSync(join(__dirname, 'dist/clipboard'), { recursive: true })
copyFileSync(
  join(__dirname, 'src/clipboard/webview.html'),
  join(__dirname, 'dist/clipboard/webview.html')
)

// 폰트 파일 복사: packages/core/assets/fonts/ → dist/assets/fonts/
const fontsSrc = join(__dirname, '../../packages/core/assets/fonts')
const fontsDst = join(__dirname, 'dist/assets/fonts')
mkdirSync(fontsDst, { recursive: true })
for (const f of readdirSync(fontsSrc)) {
  if (f.endsWith('.ttf') || f === 'LICENSE.md') {
    copyFileSync(join(fontsSrc, f), join(fontsDst, f))
  }
}

// resvg wasm 파일 복사: dist/resvg.wasm
// pnpm 모노레포: core/node_modules → 루트 node_modules 순서로 탐색
const wasmCandidates = [
  join(__dirname, '../../packages/core/node_modules/@resvg/resvg-wasm/index_bg.wasm'),
  join(__dirname, '../../node_modules/@resvg/resvg-wasm/index_bg.wasm'),
  join(__dirname, 'node_modules/@resvg/resvg-wasm/index_bg.wasm')
]
let wasmCopied = false
for (const candidate of wasmCandidates) {
  if (existsSync(candidate)) {
    mkdirSync(join(__dirname, 'dist'), { recursive: true })
    copyFileSync(candidate, join(__dirname, 'dist/resvg.wasm'))
    wasmCopied = true
    console.log(`resvg.wasm 복사 완료: ${candidate}`)
    break
  }
}
if (!wasmCopied) {
  console.warn('경고: resvg.wasm을 찾을 수 없습니다. SVG 렌더링이 실패할 수 있습니다.')
}

// 루트 LICENSE 복사
const licenseSrc = join(__dirname, '../../LICENSE')
if (existsSync(licenseSrc)) {
  copyFileSync(licenseSrc, join(__dirname, 'LICENSE'))
}

console.log('빌드 완료')

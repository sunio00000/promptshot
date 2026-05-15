import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

// 폰트 디렉토리 후보 경로 목록 (개발/테스트/번들 환경 순서로 탐색)
const FONTS_CANDIDATES = [
  join(__dirname, '../../assets/fonts'),     // 개발: packages/core/dist/theme/ → packages/core/assets/fonts/
  join(__dirname, '../assets/fonts'),        // alt
  join(__dirname, 'assets/fonts'),           // 같은 디렉토리
  join(__dirname, '../dist/assets/fonts'),   // 번들: vscode-ext/dist/ 기준
  join(__dirname, 'dist/assets/fonts'),
  join(__dirname, '../../dist/assets/fonts') // 추가 번들 경로
]

export type SatoriFont = {
  name: string
  data: Buffer
  weight: 400 | 700
  style: 'normal'
}

function findFontsDir(): string {
  for (const candidate of FONTS_CANDIDATES) {
    if (existsSync(join(candidate, 'Pretendard-Regular.ttf'))) {
      return candidate
    }
  }
  throw new Error(
    `Pretendard-Regular.ttf를 찾을 수 없습니다. 탐색 경로:\n${FONTS_CANDIDATES.join('\n')}`
  )
}

let cached: SatoriFont[] | null = null

export function loadFonts(): SatoriFont[] {
  if (cached) return cached
  const dir = findFontsDir()
  cached = [
    { name: 'Pretendard',     data: readFileSync(join(dir, 'Pretendard-Regular.ttf')),    weight: 400, style: 'normal' },
    { name: 'Pretendard',     data: readFileSync(join(dir, 'Pretendard-Bold.ttf')),       weight: 700, style: 'normal' },
    { name: 'JetBrains Mono', data: readFileSync(join(dir, 'JetBrainsMono-Regular.ttf')), weight: 400, style: 'normal' }
  ]
  return cached
}

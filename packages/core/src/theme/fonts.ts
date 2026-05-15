import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const fontsDir = join(__dirname, '../../assets/fonts')

export type SatoriFont = {
  name: string
  data: Buffer
  weight: 400 | 700
  style: 'normal'
}

let cached: SatoriFont[] | null = null

export function loadFonts(): SatoriFont[] {
  if (cached) return cached
  cached = [
    { name: 'Pretendard',     data: readFileSync(join(fontsDir, 'Pretendard-Regular.ttf')),    weight: 400, style: 'normal' },
    { name: 'Pretendard',     data: readFileSync(join(fontsDir, 'Pretendard-Bold.ttf')),       weight: 700, style: 'normal' },
    { name: 'JetBrains Mono', data: readFileSync(join(fontsDir, 'JetBrainsMono-Regular.ttf')), weight: 400, style: 'normal' }
  ]
  return cached
}

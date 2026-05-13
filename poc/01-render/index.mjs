import satori from 'satori'
import { Resvg } from '@resvg/resvg-js'
import { writeFileSync, readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

// 한글이 들어간 간단한 카드
const tree = {
  type: 'div',
  props: {
    style: {
      display: 'flex',
      width: '400px',
      height: '200px',
      background: '#f5f5f7',
      padding: '24px',
      fontFamily: 'NotoSans',
    },
    children: {
      type: 'div',
      props: {
        children: 'Hello 안녕하세요 🎉',
        style: { fontSize: '32px' },
      },
    },
  },
}

// 폰트 다운로드 (한 번만)
const fontPath = join(__dirname, 'NotoSansKR.ttf')
if (!existsSync(fontPath)) {
  const url =
    'https://fonts.gstatic.com/s/notosanskr/v39/PbyxFmXiEBPT4ITbgNA5Cgms3VYcOA-vvnIzzuoyeLQ.ttf'
  const res = await fetch(url)
  if (!res.ok) throw new Error(`폰트 다운로드 실패: ${res.status} ${url}`)
  writeFileSync(fontPath, Buffer.from(await res.arrayBuffer()))
  console.log('폰트 다운로드 완료:', fontPath)
}

const svg = await satori(tree, {
  width: 400,
  height: 200,
  fonts: [
    {
      name: 'NotoSans',
      data: readFileSync(fontPath),
      weight: 400,
      style: 'normal',
    },
  ],
})

const png = new Resvg(svg).render().asPng()
writeFileSync(join(__dirname, 'hello.png'), png)
console.log('OK', png.length, 'bytes')

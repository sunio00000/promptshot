import satori from 'satori'
import { Resvg } from '@resvg/resvg-js'
import { writeFileSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

const fontData = readFileSync(join(root, 'packages/core/assets/fonts/Pretendard-Bold.ttf'))

const tree = {
  type: 'div',
  props: {
    style: {
      display: 'flex',
      flexDirection: 'column',
      width: '128px',
      height: '128px',
      background: 'linear-gradient(135deg, #6e7bf0 0%, #b06ef0 100%)',
      padding: '14px',
      borderRadius: '24px',
      fontFamily: 'Pretendard'
    },
    children: [
      // Mini macOS window card
      {
        type: 'div',
        props: {
          style: {
            display: 'flex',
            flexDirection: 'column',
            background: '#ffffff',
            borderRadius: '10px',
            overflow: 'hidden',
            width: '100%',
            height: '100%',
            border: '1px solid rgba(0,0,0,0.05)'
          },
          children: [
            // Chrome with traffic lights
            {
              type: 'div',
              props: {
                style: {
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '6px 8px',
                  background: '#f4f4f7'
                },
                children: [
                  { type: 'div', props: { style: { display: 'flex', width: '8px', height: '8px', borderRadius: '50%', background: '#ff5f57' } } },
                  { type: 'div', props: { style: { display: 'flex', width: '8px', height: '8px', borderRadius: '50%', background: '#ffbd2e' } } },
                  { type: 'div', props: { style: { display: 'flex', width: '8px', height: '8px', borderRadius: '50%', background: '#28c93f' } } }
                ]
              }
            },
            // Big P
            {
              type: 'div',
              props: {
                style: {
                  display: 'flex',
                  flex: '1',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '54px',
                  fontWeight: 700,
                  color: '#1d1d1f'
                },
                children: 'P'
              }
            }
          ]
        }
      }
    ]
  }
}

const svg = await satori(tree, {
  width: 128,
  height: 128,
  fonts: [{ name: 'Pretendard', data: fontData, weight: 700, style: 'normal' }]
})
const png = new Resvg(svg).render().asPng()
writeFileSync(join(root, 'packages/vscode-ext/icon.png'), png)
console.log('wrote icon.png', png.length, 'bytes')

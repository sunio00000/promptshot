import satori from 'satori'
import { Resvg, initWasm } from '@resvg/resvg-wasm'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import type { Exchange } from '../types.js'
import type { Theme } from '../theme/types.js'
import { loadFonts } from '../theme/fonts.js'
import { parseMarkdown } from './markdown.js'
import { mdastToSatori, type SatoriNode } from './jsx.js'

export type RenderOptions = { width?: number; maxHeight?: number }

const __dirname = dirname(fileURLToPath(import.meta.url))

// wasm 파일 후보 경로 목록 (개발/번들/테스트 환경 순서로 탐색)
const WASM_CANDIDATES = [
  join(__dirname, '../../node_modules/@resvg/resvg-wasm/index_bg.wasm'), // 개발: packages/core/dist/render/ → packages/core/node_modules/
  join(__dirname, '../../../node_modules/@resvg/resvg-wasm/index_bg.wasm'), // 모노레포 루트 node_modules
  join(__dirname, '../../../../node_modules/@resvg/resvg-wasm/index_bg.wasm'), // pnpm 호이스팅
  join(__dirname, 'resvg.wasm'),  // 번들: vscode-ext/dist/ 에 복사된 wasm
  join(__dirname, '../resvg.wasm')
]

let wasmInitialized = false

async function ensureWasmInitialized(): Promise<void> {
  if (wasmInitialized) return
  for (const candidate of WASM_CANDIDATES) {
    if (existsSync(candidate)) {
      const buf = readFileSync(candidate)
      await initWasm(buf)
      wasmInitialized = true
      return
    }
  }
  throw new Error(
    `@resvg/resvg-wasm: index_bg.wasm not found. Tried:\n${WASM_CANDIDATES.join('\n')}`
  )
}

export async function renderExchange(ex: Exchange, theme: Theme, opts: RenderOptions = {}): Promise<Buffer> {
  await ensureWasmInitialized()

  const width = opts.width ?? 720
  const userBody = await mdastToSatori(parseMarkdown(ex.user.content), theme)
  const aiBody = await mdastToSatori(parseMarkdown(ex.assistant.content), theme)

  const tree = buildTree(ex, theme, width, userBody, aiBody)

  const svg = await satori(tree as never, {
    width: width + theme.outerPadding * 2,
    fonts: loadFonts() as never
  })
  const png = new Resvg(svg).render().asPng()
  return Buffer.from(png)
}

function buildTree(
  ex: Exchange,
  theme: Theme,
  width: number,
  userBody: SatoriNode,
  aiBody: SatoriNode
): SatoriNode {
  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        width: `${width}px`,
        background: theme.outerBackground,
        padding: `${theme.outerPadding}px`,
        fontFamily: theme.font.sans
      },
      children: [
        // macOS 스타일 창 레이아웃
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              flexDirection: 'column',
              background: theme.windowBackground,
              borderRadius: `${theme.cornerRadius}px`,
              overflow: 'hidden',
              border: `1px solid ${theme.windowBorder}`
            },
            children: [
              // 크롬 상단 바
              chrome(ex, theme),
              // 본문 영역
              body(ex, theme, userBody, aiBody)
            ]
          }
        }
      ]
    }
  }
}

function chrome(ex: Exchange, theme: Theme): SatoriNode {
  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        alignItems: 'center',
        padding: '10px 14px',
        gap: '6px',
        background: theme.chromeBackground,
        borderBottom: `1px solid ${theme.windowBorder}`
      },
      children: [
        // 신호등 버튼
        ...theme.trafficLightColors.map(
          c =>
            ({
              type: 'div',
              props: {
                style: {
                  display: 'flex',
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  background: c
                }
              }
            } as SatoriNode)
        ),
        // 중앙 제목/타임스탬프
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              flex: '1',
              justifyContent: 'center',
              color: theme.textSecondary,
              fontSize: '12px'
            },
            children: `${ex.sourceLabel} · ${formatRel(ex.timestamp)}`
          }
        }
      ]
    }
  }
}

function body(ex: Exchange, theme: Theme, userBody: SatoriNode, aiBody: SatoriNode): SatoriNode {
  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        padding: '20px',
        gap: '16px'
      },
      children: [
        // 사용자 섹션
        sectionLabel('You', theme),
        userBody,
        // 구분선
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              height: '1px',
              background: theme.windowBorder,
              margin: '4px 0'
            }
          }
        },
        // AI 응답 섹션
        sectionLabel(ex.sourceLabel, theme),
        aiBody
      ]
    }
  }
}

function sectionLabel(text: string, theme: Theme): SatoriNode {
  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        fontSize: '11px',
        fontWeight: 700,
        color: theme.textSecondary,
        letterSpacing: '0.5px'
      },
      children: text
    }
  }
}

function formatRel(d: Date): string {
  const s = Math.floor((Date.now() - d.getTime()) / 1000)
  if (s < 60) return `${s}초 전`
  if (s < 3600) return `${Math.floor(s / 60)}분 전`
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`
  return `${Math.floor(s / 86400)}일 전`
}

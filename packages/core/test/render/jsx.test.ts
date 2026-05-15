import { describe, it, expect } from 'vitest'
import { mdastToSatori } from '../../src/render/jsx.js'
import { parseMarkdown } from '../../src/render/markdown.js'
import { macLight } from '../../src/theme/mac-light.js'

describe('mdastToSatori', () => {
  it('converts paragraph to a Satori-compatible node', async () => {
    const ast = parseMarkdown('Hello world')
    const node = await mdastToSatori(ast, macLight)
    expect(node).toBeTruthy()
    expect(node.type).toBe('div')
  })

  it('converts code block (with shiki tokens)', async () => {
    const ast = parseMarkdown('```ts\nconst x = 1\n```')
    const node = await mdastToSatori(ast, macLight)
    // 트리 안 어딘가에 monospace 스타일이 있어야 함
    expect(JSON.stringify(node)).toMatch(/JetBrains Mono/)
  })
})

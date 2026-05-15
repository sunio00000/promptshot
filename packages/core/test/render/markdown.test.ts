import { describe, it, expect } from 'vitest'
import { parseMarkdown } from '../../src/render/markdown.js'

describe('parseMarkdown', () => {
  it('produces an AST with root and paragraph', () => {
    const ast = parseMarkdown('Hello **world**')
    expect(ast.type).toBe('root')
    expect(ast.children[0].type).toBe('paragraph')
  })

  it('handles GFM tables', () => {
    const ast = parseMarkdown('| a | b |\n|---|---|\n| 1 | 2 |')
    const table = ast.children.find((c) => c.type === 'table')
    expect(table).toBeDefined()
  })

  it('handles fenced code blocks', () => {
    const ast = parseMarkdown('```ts\nconst x = 1\n```')
    const code = ast.children.find((c) => c.type === 'code')
    expect(code).toBeDefined()
    expect((code as { lang?: string }).lang).toBe('ts')
  })
})

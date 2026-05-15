import type { Root, RootContent, PhrasingContent, Table, List, Heading, Code, Paragraph } from 'mdast'
import type { Theme } from '../theme/types.js'
import { highlightCode } from './highlight.js'

export type SatoriNode = {
  type: string
  props: {
    style?: Record<string, unknown>
    children?: SatoriChild | SatoriChild[]
  }
}
type SatoriChild = SatoriNode | string

function div(style: Record<string, unknown>, children: SatoriChild | SatoriChild[]): SatoriNode {
  return { type: 'div', props: { style: { display: 'flex', ...style }, children } }
}

function span(style: Record<string, unknown>, children: SatoriChild | SatoriChild[]): SatoriNode {
  return { type: 'span', props: { style, children } }
}

export async function mdastToSatori(root: Root, theme: Theme): Promise<SatoriNode> {
  const children: SatoriChild[] = []
  for (const node of root.children) {
    const rendered = await renderBlock(node, theme)
    if (rendered) children.push(rendered)
  }
  return div({
    flexDirection: 'column',
    gap: '12px',
    color: theme.textPrimary,
    fontFamily: theme.font.sans
  }, children)
}

async function renderBlock(node: RootContent, theme: Theme): Promise<SatoriNode | null> {
  switch (node.type) {
    case 'paragraph': {
      const paraNode = node as Paragraph
      const kids = paraNode.children.map(c => renderInline(c, theme))
      return div({ flexWrap: 'wrap', fontSize: '14px', lineHeight: 1.6 }, kids)
    }
    case 'heading': {
      const headingNode = node as Heading
      const kids = headingNode.children.map(c => renderInline(c, theme))
      return div({
        fontSize: headingNode.depth === 1 ? '20px' : '16px',
        fontWeight: 700,
        marginTop: '8px'
      }, kids)
    }
    case 'code': {
      const codeNode = node as Code
      const lines = await highlightCode(codeNode.value, codeNode.lang ?? 'text', theme.codeTheme)
      const lineNodes: SatoriChild[] = lines.map(line => {
        const tokens: SatoriChild[] = line.map(t => span({ color: t.color }, t.content))
        return div({}, tokens)
      })
      return div({
        flexDirection: 'column',
        fontFamily: theme.font.mono,
        fontSize: '12px',
        background: theme.codeTheme === 'github-dark' ? '#0d1117' : '#f6f8fa',
        padding: '12px',
        borderRadius: '8px',
        overflow: 'hidden'
      }, lineNodes)
    }
    case 'list': {
      const listNode = node as List
      const items: SatoriChild[] = listNode.children.map((li, i) => {
        const liKids: SatoriChild[] = []
        for (const child of li.children) {
          // li.children은 블록 레벨 (paragraph 등); paragraph의 인라인으로 평탄화
          if (child.type === 'paragraph') {
            for (const inline of (child as Paragraph).children) {
              liKids.push(renderInline(inline, theme))
            }
          }
        }
        const bullet = listNode.ordered ? `${(listNode.start ?? 1) + i}.` : '•'
        return div({}, [span({ marginRight: '6px' }, bullet), div({ flex: '1', flexWrap: 'wrap' }, liKids)])
      })
      return div({ flexDirection: 'column', gap: '4px', paddingLeft: '16px' }, items)
    }
    case 'table': {
      const tableNode = node as Table
      const rows: SatoriChild[] = tableNode.children.map((row, ri) => {
        const cells: SatoriChild[] = row.children.map(cell => {
          const cellKids = cell.children.map(c => renderInline(c, theme))
          return div({ padding: '6px 10px', flex: '1', fontSize: '13px' }, cellKids)
        })
        return div({
          borderBottom: ri < tableNode.children.length - 1 ? `1px solid ${theme.windowBorder}` : 'none'
        }, cells)
      })
      return div({
        flexDirection: 'column',
        border: `1px solid ${theme.windowBorder}`,
        borderRadius: '6px'
      }, rows)
    }
    default:
      return null
  }
}

function renderInline(node: PhrasingContent, theme: Theme): SatoriChild {
  switch (node.type) {
    case 'text':
      return node.value
    case 'strong':
      return span({ fontWeight: 700 }, (node.children ?? []).map(c => renderInline(c, theme)))
    case 'emphasis':
      return span({ fontStyle: 'italic' }, (node.children ?? []).map(c => renderInline(c, theme)))
    case 'inlineCode':
      return span({
        fontFamily: theme.font.mono,
        background: theme.codeTheme === 'github-dark' ? '#161b22' : '#f0f0f3',
        padding: '1px 4px',
        borderRadius: '4px',
        fontSize: '12px'
      }, node.value)
    case 'link':
      return span({ color: '#0969da' }, (node.children ?? []).map(c => renderInline(c, theme)))
    default:
      return ''
  }
}

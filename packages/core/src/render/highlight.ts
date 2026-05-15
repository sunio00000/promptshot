import { createHighlighter, type Highlighter } from 'shiki'

export type CodeToken = { content: string; color?: string }

let highlighter: Highlighter | null = null

async function getHl(): Promise<Highlighter> {
  if (highlighter) return highlighter
  highlighter = await createHighlighter({
    themes: ['github-light', 'github-dark'],
    langs: ['typescript', 'javascript', 'json', 'python', 'bash', 'css', 'html', 'markdown', 'go', 'rust', 'yaml']
  })
  return highlighter
}

export async function highlightCode(
  code: string,
  lang: string,
  theme: 'github-light' | 'github-dark'
): Promise<CodeToken[][]> {
  const hl = await getHl()
  const knownLangs = hl.getLoadedLanguages()
  const langToUse = (knownLangs as readonly string[]).includes(lang) ? lang : 'text'
  const result = hl.codeToTokens(code, { lang: langToUse as never, theme })
  return result.tokens.map(line => line.map(t => ({ content: t.content, color: t.color })))
}

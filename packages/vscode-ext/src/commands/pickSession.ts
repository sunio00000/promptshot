import * as vscode from 'vscode'
import { loadCore } from '../coreLoader'
import { captureImageCommand } from './captureImage'
import { captureMarkdownCommand } from './captureMarkdown'

export async function pickSessionCommand(context: vscode.ExtensionContext): Promise<void> {
  const core = await loadCore()
  const codex = new core.CodexSource()
  const claude = new core.ClaudeCodeSource()

  const [codexFiles, claudeFiles] = await Promise.all([
    codex.discoverSessions(),
    claude.discoverSessions()
  ])

  type Item = vscode.QuickPickItem & { sessionPath: string }

  const items: Item[] = [
    ...codexFiles.slice(0, 15).map(f => ({
      label: `$(squirrel) Codex`,
      description: f.mtime.toLocaleString(),
      detail: f.path,
      sessionPath: f.path
    })),
    ...claudeFiles.slice(0, 15).map(f => ({
      label: `$(robot) Claude Code`,
      description: f.mtime.toLocaleString(),
      detail: f.path,
      sessionPath: f.path
    }))
  ].sort((a, b) => {
    // mtime 내림차순 (최신 우선)
    return b.description!.localeCompare(a.description!)
  })

  if (items.length === 0) {
    vscode.window.showWarningMessage('Promptshot: no sessions found')
    return
  }

  const picked = await vscode.window.showQuickPick(items, {
    placeHolder: '캡쳐할 세션을 선택하세요 (mtime 최신순)',
    matchOnDescription: true,
    matchOnDetail: true
  })
  if (!picked) return

  const format = await vscode.window.showQuickPick(
    [
      { label: '$(file-media) Image (PNG)', description: 'Clipboard + file', value: 'image' as const },
      { label: '$(markdown) Markdown', description: 'Clipboard only', value: 'markdown' as const }
    ],
    { placeHolder: '출력 형식 선택' }
  )
  if (!format) return

  if (format.value === 'image') {
    await captureImageCommand(context, { sessionPath: picked.sessionPath })
  } else {
    await captureMarkdownCommand({ sessionPath: picked.sessionPath })
  }
}

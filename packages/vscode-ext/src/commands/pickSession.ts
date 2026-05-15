import * as vscode from 'vscode'
import { loadCore } from '../coreLoader'

export async function pickSessionCommand(): Promise<void> {
  const core = await loadCore()
  const codex = new core.CodexSource()
  const claude = new core.ClaudeCodeSource()

  const [codexFiles, claudeFiles] = await Promise.all([
    codex.discoverSessions(),
    claude.discoverSessions()
  ])

  const items: vscode.QuickPickItem[] = [
    ...codexFiles.slice(0, 10).map(f => ({
      label: `$(squirrel) Codex · ${f.mtime.toLocaleString()}`,
      description: f.path
    })),
    ...claudeFiles.slice(0, 10).map(f => ({
      label: `$(robot) Claude Code · ${f.mtime.toLocaleString()}`,
      description: f.path
    }))
  ]

  if (items.length === 0) {
    vscode.window.showWarningMessage('Promptshot: no sessions found')
    return
  }

  const pick = await vscode.window.showQuickPick(items, {
    placeHolder: '캡쳐할 세션을 선택하세요'
  })
  if (!pick) return

  // v1: trigger captureLastExchange — passing a specific session path is a v1.1 enhancement.
  // The user picked from a list to learn what's available; the actual capture uses latest.
  // (A note in the description tells the user this.)
  vscode.window.showInformationMessage(
    `Promptshot v1: 세션 명시 캡쳐는 미지원. 가장 최근 세션으로 진행. (선택: ${pick.description?.split(/[/\\]/).pop()})`
  )
  await vscode.commands.executeCommand('promptshot.captureLastExchange')
}

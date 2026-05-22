import * as vscode from 'vscode'
import { loadCore } from '../coreLoader'
import { getConfig } from '../config'

export async function captureMarkdownCommand(opts?: { sessionPath?: string }): Promise<void> {
  const core = await loadCore()
  const cfg = getConfig()
  const ws = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath

  try {
    const ex = await core.selectLatestExchange({
      source: cfg.source,
      workspaceHint: ws,
      sessionPath: opts?.sessionPath
    })
    if (!ex) {
      vscode.window.showWarningMessage('Promptshot: no exchange to capture')
      return
    }
    const user = core.redactSecrets(ex.user.content)
    const ai = core.redactSecrets(ex.assistant.content)

    const md = [
      `**${ex.sourceLabel}** · via Promptshot — ${ex.timestamp.toLocaleString()}`,
      ``,
      `### You`,
      user.text,
      ``,
      `### ${ex.sourceLabel}`,
      ai.text
    ].join('\n')

    await vscode.env.clipboard.writeText(md)
    const hits = [...user.hits, ...ai.hits]
    const suffix = hits.length ? ` · Redacted: ${hits.join(', ')}` : ''
    vscode.window.showInformationMessage(`Markdown copied${suffix}`)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    vscode.window.showErrorMessage(`Promptshot: ${msg}`)
  }
}

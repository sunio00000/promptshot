import * as vscode from 'vscode'
import { loadCore } from '../coreLoader'
import { getConfig } from '../config'
import { copyImageToClipboard } from '../clipboard/image'

let lastCapturePath: string | null = null
export function getLastCapturePath(): string | null {
  return lastCapturePath
}

export async function captureImageCommand(
  context: vscode.ExtensionContext,
  opts?: { sessionPath?: string }
): Promise<void> {
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
      vscode.window.showWarningMessage('Promptshot: 마지막 user→assistant 쌍을 찾지 못했습니다.')
      return
    }

    const user = core.redactSecrets(ex.user.content)
    const ai = core.redactSecrets(ex.assistant.content)
    const redactedHits = [...user.hits, ...ai.hits]
    const exForRender = {
      ...ex,
      user: { content: user.text },
      assistant: { ...ex.assistant, content: ai.text }
    }

    const png = await core.renderExchange(
      exForRender,
      core.getTheme(cfg.theme),
      { width: cfg.width, maxHeight: cfg.maxHeight }
    )
    const filePath = await core.saveImageToFile(png, cfg.outputDir)
    lastCapturePath = filePath

    const clipboardOk = await copyImageToClipboard(context, png)

    const summary = clipboardOk
      ? `Captured · ${ex.sourceLabel}${redactedHits.length ? ` · Redacted: ${redactedHits.join(', ')}` : ''}`
      : `Captured (file only — clipboard failed) · ${ex.sourceLabel}`
    const action = await vscode.window.showInformationMessage(summary, 'Open File', 'Reveal in Folder')
    if (action === 'Open File') {
      await vscode.env.openExternal(vscode.Uri.file(filePath))
    } else if (action === 'Reveal in Folder') {
      await vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(filePath))
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    vscode.window.showErrorMessage(`Promptshot: ${msg}`)
  }
}

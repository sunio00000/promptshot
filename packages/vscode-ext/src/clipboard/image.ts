import * as vscode from 'vscode'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const TIMEOUT_MS = 5000

export async function copyImageToClipboard(context: vscode.ExtensionContext, png: Buffer): Promise<boolean> {
  return new Promise<boolean>(resolve => {
    const panel = vscode.window.createWebviewPanel(
      'promptshotClipboard',
      'Promptshot',
      { viewColumn: vscode.ViewColumn.Active, preserveFocus: false },
      { enableScripts: true, retainContextWhenHidden: false }
    )
    const htmlPath = join(context.extensionPath, 'dist', 'clipboard', 'webview.html')
    panel.webview.html = readFileSync(htmlPath, 'utf8')

    const timeout = setTimeout(() => {
      panel.dispose()
      resolve(false)
    }, TIMEOUT_MS)

    panel.webview.onDidReceiveMessage((msg: { type: string; ok?: boolean; error?: string }) => {
      if (msg.type === 'ready') {
        panel.webview.postMessage({ type: 'png', data: png.toString('base64') })
      } else if (msg.type === 'done') {
        clearTimeout(timeout)
        panel.dispose()
        resolve(msg.ok === true)
      }
    })
  })
}

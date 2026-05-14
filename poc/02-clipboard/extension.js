const vscode = require('vscode')
const fs = require('node:fs')
const path = require('node:path')

function activate(context) {
  context.subscriptions.push(vscode.commands.registerCommand('pocClipboard.test', async () => {
    // 1x1 빨강 PNG (테스트용 작은 이미지)
    const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=='

    const panel = vscode.window.createWebviewPanel(
      'pocClipboard', 'PoC', vscode.ViewColumn.One,
      { enableScripts: true, retainContextWhenHidden: false }
    )
    const html = fs.readFileSync(path.join(__dirname, 'webview.html'), 'utf8')
    panel.webview.html = html

    const timeout = setTimeout(() => {
      vscode.window.showWarningMessage('Clipboard PoC: Webview 응답 없음 (타임아웃)')
      panel.dispose()
    }, 5000)

    panel.webview.onDidReceiveMessage(msg => {
      if (msg.type === 'ready') panel.webview.postMessage({ type: 'png', data: pngBase64 })
      if (msg.type === 'done') {
        clearTimeout(timeout)
        vscode.window.showInformationMessage(msg.ok ? 'Clipboard OK' : `Clipboard FAIL: ${msg.error}`)
        panel.dispose()
      }
    })
  }))
}
exports.activate = activate

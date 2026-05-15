import * as assert from 'node:assert'
import * as vscode from 'vscode'

suite('Promptshot Extension', () => {
  test('all 5 commands are registered after activation', async () => {
    // 테스트 러너의 extensionDevelopmentPath를 통해 익스텐션이 로드됨
    // 명시적으로 activate 시도
    const ext = vscode.extensions.getExtension('TBD-set-before-publish.promptshot')
    if (ext) await ext.activate()

    const all = await vscode.commands.getCommands(true)
    const expected = [
      'promptshot.captureLastExchange',
      'promptshot.captureAsMarkdown',
      'promptshot.pickSession',
      'promptshot.chooseTheme',
      'promptshot.openLastCapture'
    ]
    for (const cmd of expected) {
      assert.ok(all.includes(cmd), `Expected command '${cmd}' to be registered`)
    }
  })

  test('configuration defaults are reachable', () => {
    const cfg = vscode.workspace.getConfiguration('promptshot')
    assert.strictEqual(cfg.get('theme'), 'mac-light')
    assert.strictEqual(cfg.get('source'), 'auto')
    assert.strictEqual(cfg.get('width'), 720)
    assert.strictEqual(cfg.get('maxHeight'), 4000)
    assert.strictEqual(cfg.get('includeTools'), false)
    assert.strictEqual(cfg.get('includeSystem'), false)
  })
})

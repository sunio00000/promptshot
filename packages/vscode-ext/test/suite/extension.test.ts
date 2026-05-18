import * as assert from 'node:assert'
import * as vscode from 'vscode'

suite('Promptshot Extension', () => {
  test('all 5 commands are registered after activation', async function () {
    // 번들된 dist/extension.js(~10MB) 파싱 시간 + activate() 시간을 위해
    // 기본 2s mocha timeout을 30s로 확장.
    this.timeout(30000)
    // publisher가 바뀌어도 깨지지 않게 package.json name으로 lookup.
    const ext = vscode.extensions.all.find(e => e.packageJSON.name === 'promptshot')
    assert.ok(ext, 'Promptshot extension must be discoverable by name')
    await ext.activate()

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

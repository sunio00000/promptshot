import { mkdirSync, copyFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// 워크스페이스 루트를 기준으로 경로를 해결합니다.
// 이 스크립트가 어느 cwd에서 실행되든 올바른 경로를 사용합니다.
const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const tasks = [
  {
    src: resolve(root, 'packages/vscode-ext/src/clipboard/webview.html'),
    dst: resolve(root, 'packages/vscode-ext/dist/clipboard/webview.html')
  }
]

for (const t of tasks) {
  mkdirSync(dirname(t.dst), { recursive: true })
  copyFileSync(t.src, t.dst)
  console.log('copied', t.dst)
}

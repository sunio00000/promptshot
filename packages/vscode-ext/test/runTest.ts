import { runTests } from '@vscode/test-electron'
import { resolve } from 'node:path'

async function main() {
  // dist/test/runTest.js → dist/ → packages/vscode-ext
  const extensionDevelopmentPath = resolve(__dirname, '..', '..')
  const extensionTestsPath = resolve(__dirname, './suite/index.js')
  try {
    await runTests({ extensionDevelopmentPath, extensionTestsPath })
  } catch (e) {
    console.error('Failed to run tests', e)
    process.exit(1)
  }
}

main()

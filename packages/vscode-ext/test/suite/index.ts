import { glob } from 'glob'
import Mocha from 'mocha'
import { resolve } from 'node:path'

export async function run(): Promise<void> {
  const mocha = new Mocha({ ui: 'tdd', color: true })
  const testsRoot = resolve(__dirname)
  const files = await glob('**/*.test.js', { cwd: testsRoot })
  files.forEach(f => mocha.addFile(resolve(testsRoot, f)))
  return new Promise((res, rej) => {
    mocha.run(failures => failures > 0 ? rej(new Error(`${failures} tests failed`)) : res())
  })
}

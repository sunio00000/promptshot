import * as vscode from 'vscode'
import { homedir } from 'node:os'
import { join } from 'node:path'

export type Config = {
  theme: 'mac-light' | 'mac-dark'
  source: 'auto' | 'codex' | 'claude-code'
  outputDir: string
  width: number
  maxHeight: number
  includeTools: boolean
  includeSystem: boolean
}

export function getConfig(): Config {
  const c = vscode.workspace.getConfiguration('promptshot')
  return {
    theme: c.get<'mac-light' | 'mac-dark'>('theme', 'mac-light'),
    source: c.get<'auto' | 'codex' | 'claude-code'>('source', 'auto'),
    outputDir: c.get<string>('outputDir', '') || join(homedir(), 'Pictures', 'Promptshot'),
    width: c.get<number>('width', 720),
    maxHeight: c.get<number>('maxHeight', 4000),
    includeTools: c.get<boolean>('includeTools', false),
    includeSystem: c.get<boolean>('includeSystem', false)
  }
}

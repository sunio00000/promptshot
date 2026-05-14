export type SourceId = 'codex' | 'claude-code'

export type Exchange = {
  source: SourceId
  sourceLabel: string
  sessionId: string
  sessionPath: string
  timestamp: Date
  user: { content: string }
  assistant: { content: string; model?: string }
}

export type SessionFile = {
  path: string
  mtime: Date
}

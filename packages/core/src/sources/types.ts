import type { Exchange, SessionFile, SourceId } from '../types.js'

export interface ChatSource {
  readonly id: SourceId
  readonly label: string
  discoverSessions(): Promise<SessionFile[]>
  parseLastExchange(file: SessionFile): Promise<Exchange | null>
}

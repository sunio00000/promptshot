export type RedactPattern = { name: string; regex: RegExp }

export const PATTERNS: RedactPattern[] = [
  { name: 'openai',  regex: /sk-[A-Za-z0-9]{20,}/g },
  { name: 'github',  regex: /gh[ps]_[A-Za-z0-9]{30,}/g },
  { name: 'jwt',     regex: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}/g },
  { name: 'aws',     regex: /AKIA[0-9A-Z]{16}/g },
  { name: 'google',  regex: /AIza[0-9A-Za-z_-]{35}/g }
]

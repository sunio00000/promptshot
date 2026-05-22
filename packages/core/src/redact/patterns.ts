export type RedactPattern = { name: string; regex: RegExp }

export const PATTERNS: RedactPattern[] = [
  // Multi-line block — must run first so its base64 body cannot match other patterns
  { name: 'private_key', regex: /-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----[\s\S]+?-----END (?:[A-Z]+ )?PRIVATE KEY-----/g },
  // More specific prefixes before their generalizations
  { name: 'anthropic', regex: /sk-ant-[A-Za-z0-9_-]{20,}/g },
  { name: 'jwt',       regex: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}/g },
  // Prefix-based token patterns
  { name: 'openai',  regex: /sk-[A-Za-z0-9]{20,}/g },
  { name: 'github',  regex: /gh[ps]_[A-Za-z0-9]{30,}/g },
  { name: 'slack',   regex: /(?:xox[abpsrn]|xapp)-[A-Za-z0-9-]{10,}/g },
  { name: 'stripe',  regex: /(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{20,}/g },
  { name: 'aws',     regex: /AKIA[0-9A-Z]{16}/g },
  { name: 'google',  regex: /AIza[0-9A-Za-z_-]{35}/g },
  // DB URL with embedded credentials
  { name: 'db_url',  regex: /(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|amqps?):\/\/[^\s'"<>]+:[^\s'"<>]+@[^\s'"<>]+/g },
  // Catch-all Bearer (JWT already handled above)
  { name: 'bearer',  regex: /Bearer\s+[A-Za-z0-9._~+\/=-]{20,}/g }
]

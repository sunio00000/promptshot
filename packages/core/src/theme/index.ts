import { macLight } from './mac-light.js'
import { macDark } from './mac-dark.js'
import type { Theme } from './types.js'

export const themes: Record<Theme['name'], Theme> = {
  'mac-light': macLight,
  'mac-dark': macDark
}

export function getTheme(name: Theme['name']): Theme {
  return themes[name]
}

export type { Theme }

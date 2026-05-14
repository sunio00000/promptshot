import type { Theme } from './types.js'

export const macLight: Theme = {
  name: 'mac-light',
  outerBackground: '#f5f5f7',
  outerPadding: 32,
  windowBackground: '#ffffff',
  windowBorder: '#e5e5ea',
  cornerRadius: 12,
  shadowColor: 'rgba(0,0,0,0.10)',
  textPrimary: '#1d1d1f',
  textSecondary: '#6e6e73',
  chromeBackground: '#f6f6f6',
  trafficLightColors: ['#ff5f57', '#ffbd2e', '#28c93f'],
  codeTheme: 'github-light',
  font: { sans: 'Pretendard', mono: 'JetBrains Mono' }
}

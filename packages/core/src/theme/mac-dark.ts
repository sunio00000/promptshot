import type { Theme } from './types.js'

export const macDark: Theme = {
  name: 'mac-dark',
  outerBackground: '#1e1e1e',
  outerPadding: 32,
  windowBackground: '#2c2c2e',
  windowBorder: '#3a3a3c',
  cornerRadius: 12,
  shadowColor: 'rgba(0,0,0,0.45)',
  textPrimary: '#f2f2f7',
  textSecondary: '#aeaeb2',
  chromeBackground: '#3a3a3c',
  trafficLightColors: ['#ff5f57', '#ffbd2e', '#28c93f'],
  codeTheme: 'github-dark',
  font: { sans: 'Pretendard', mono: 'JetBrains Mono' }
}

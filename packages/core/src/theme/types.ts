export type Theme = {
  name: 'mac-light' | 'mac-dark'
  outerBackground: string
  outerPadding: number
  windowBackground: string
  windowBorder: string
  cornerRadius: number
  shadowColor: string
  textPrimary: string
  textSecondary: string
  chromeBackground: string
  trafficLightColors: [string, string, string]  // red, yellow, green
  codeTheme: 'github-light' | 'github-dark'
  font: { sans: string; mono: string }
}

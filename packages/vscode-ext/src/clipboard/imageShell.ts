import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import { writeFile, mkdtemp, unlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const execAsync = promisify(exec)

/**
 * OS shell-based image clipboard. Used as fallback when Webview clipboard API
 * fails (which is almost always due to lack of transient activation).
 *
 * Each platform uses OS-native tools, no native modules required:
 * - Windows: PowerShell + System.Windows.Forms.Clipboard
 * - macOS:   osascript (AppleScript)
 * - Linux:   xclip (must be installed; falls back to false if missing)
 */
export async function copyImageToClipboardViaShell(png: Buffer): Promise<boolean> {
  const tmp = await mkdtemp(join(tmpdir(), 'promptshot-clip-'))
  const file = join(tmp, 'clip.png')
  await writeFile(file, png)

  try {
    if (process.platform === 'win32') return await winSetImage(file)
    if (process.platform === 'darwin') return await macSetImage(file)
    if (process.platform === 'linux') return await linuxSetImage(file)
    return false
  } catch {
    return false
  } finally {
    // 정리 시도 (플랫폼이 잠깐 핸들을 유지할 수 있으므로 지연 후 삭제)
    setTimeout(() => { unlink(file).catch(() => undefined) }, 5000)
  }
}

async function winSetImage(file: string): Promise<boolean> {
  // PowerShell: System.Drawing + System.Windows.Forms로 PNG를 Bitmap으로 읽어 클립보드에 배치
  const escaped = file.replace(/'/g, "''")
  const ps = [
    `Add-Type -AssemblyName System.Drawing`,
    `Add-Type -AssemblyName System.Windows.Forms`,
    `$img = [System.Drawing.Image]::FromFile('${escaped}')`,
    `[System.Windows.Forms.Clipboard]::SetImage($img)`,
    `$img.Dispose()`
  ].join('; ')
  // -STA: 클립보드 접근을 위한 Single-Threaded Apartment 모드. -NoProfile: 시작 속도 향상.
  await execAsync(`powershell -NoProfile -STA -Command "${ps}"`, { windowsHide: true })
  return true
}

async function macSetImage(file: string): Promise<boolean> {
  // AppleScript: PNG 파일을 읽어 클립보드에 설정
  const escaped = file.replace(/"/g, '\\"')
  const cmd = `osascript -e 'set the clipboard to (read (POSIX file "${escaped}") as «class PNGf»)'`
  await execAsync(cmd)
  return true
}

async function linuxSetImage(file: string): Promise<boolean> {
  // xclip: PNG 파일을 clipboard selection에 복사
  // xclip이 PATH에 있어야 함 (대부분 배포판에 기본 포함)
  await execAsync(`xclip -selection clipboard -t image/png -i "${file}"`)
  return true
}

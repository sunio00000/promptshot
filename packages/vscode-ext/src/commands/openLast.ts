import * as vscode from 'vscode'
import { getLastCapturePath } from './captureImage'

export async function openLastCaptureCommand(): Promise<void> {
  const p = getLastCapturePath()
  if (!p) {
    vscode.window.showInformationMessage('Promptshot: 캡쳐 기록이 없습니다')
    return
  }
  await vscode.env.openExternal(vscode.Uri.file(p))
}

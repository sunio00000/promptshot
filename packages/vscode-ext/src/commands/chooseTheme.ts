import * as vscode from 'vscode'

export async function chooseThemeCommand(): Promise<void> {
  const pick = await vscode.window.showQuickPick(
    [{ label: 'mac-light' }, { label: 'mac-dark' }],
    { placeHolder: '테마 선택' }
  )
  if (!pick) return
  await vscode.workspace
    .getConfiguration('promptshot')
    .update('theme', pick.label, vscode.ConfigurationTarget.Global)
  vscode.window.showInformationMessage(`Promptshot theme: ${pick.label}`)
}

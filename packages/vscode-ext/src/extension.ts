import * as vscode from 'vscode'
import { captureImageCommand } from './commands/captureImage'
import { captureMarkdownCommand } from './commands/captureMarkdown'
import { pickSessionCommand } from './commands/pickSession'
import { chooseThemeCommand } from './commands/chooseTheme'
import { openLastCaptureCommand } from './commands/openLast'

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('promptshot.captureLastExchange', () => captureImageCommand(context)),
    vscode.commands.registerCommand('promptshot.captureAsMarkdown', () => captureMarkdownCommand()),
    vscode.commands.registerCommand('promptshot.pickSession', () => pickSessionCommand(context)),
    vscode.commands.registerCommand('promptshot.chooseTheme', () => chooseThemeCommand()),
    vscode.commands.registerCommand('promptshot.openLastCapture', () => openLastCaptureCommand())
  )
}

export function deactivate(): void {}

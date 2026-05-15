import * as vscode from 'vscode'
import { captureImageCommand } from './commands/captureImage'

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('promptshot.captureLastExchange', () => captureImageCommand(context))
  )
}

export function deactivate(): void {}

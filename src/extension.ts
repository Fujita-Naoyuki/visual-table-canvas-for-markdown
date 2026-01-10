import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
    console.log('Visual Table Canvas for Markdown is now active!');

    // Register the edit table command
    const editTableCommand = vscode.commands.registerCommand(
        'visualTableCanvas.editTable',
        () => {
            vscode.window.showInformationMessage('Edit Table command executed!');
        }
    );

    context.subscriptions.push(editTableCommand);
}

export function deactivate() {
    // Cleanup when extension is deactivated
}

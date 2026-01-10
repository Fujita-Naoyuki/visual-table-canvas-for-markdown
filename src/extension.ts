import * as vscode from 'vscode';
import { TableCodeLensProvider } from './codeLensProvider';
import { TableInfo } from './tableParser';

export function activate(context: vscode.ExtensionContext) {
    console.log('Visual Table Canvas for Markdown is now active!');

    // Register CodeLens provider for Markdown files
    const codeLensProvider = new TableCodeLensProvider();
    const codeLensDisposable = vscode.languages.registerCodeLensProvider(
        { language: 'markdown', scheme: 'file' },
        codeLensProvider
    );

    // Register the edit table command
    const editTableCommand = vscode.commands.registerCommand(
        'visualTableCanvas.editTable',
        (uri?: vscode.Uri, table?: TableInfo, tableIndex?: number) => {
            if (uri && table) {
                vscode.window.showInformationMessage(
                    `Opening table editor for table ${(tableIndex ?? 0) + 1} ` +
                    `(${table.data.length} rows, ${table.data[0]?.length ?? 0} columns)`
                );
                // TODO: Phase 3 - Open Webview Panel
            } else {
                vscode.window.showInformationMessage('Edit Table: No table selected');
            }
        }
    );

    context.subscriptions.push(codeLensDisposable, editTableCommand);
}

export function deactivate() {
    // Cleanup when extension is deactivated
}

import * as vscode from 'vscode';
import { parseMarkdownTables, TableInfo } from './tableParser';

/**
 * CodeLens provider for Markdown tables
 * Displays "Edit" link above each table
 */
export class TableCodeLensProvider implements vscode.CodeLensProvider {
    private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
    public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;

    constructor() {
        // Refresh CodeLenses when document changes
        vscode.workspace.onDidChangeTextDocument(() => {
            this._onDidChangeCodeLenses.fire();
        });
    }

    public provideCodeLenses(
        document: vscode.TextDocument,
        _token: vscode.CancellationToken
    ): vscode.CodeLens[] | Thenable<vscode.CodeLens[]> {
        if (document.languageId !== 'markdown') {
            return [];
        }

        const text = document.getText();
        const tables = parseMarkdownTables(text);
        const codeLenses: vscode.CodeLens[] = [];

        tables.forEach((table: TableInfo, index: number) => {
            const range = new vscode.Range(
                new vscode.Position(table.startLine, 0),
                new vscode.Position(table.startLine, 0)
            );

            const codeLens = new vscode.CodeLens(range, {
                title: '$(edit) Edit Table',
                tooltip: 'Edit this table with visual editor',
                command: 'visualTableCanvas.editTable',
                arguments: [document.uri, table, index]
            });

            codeLenses.push(codeLens);
        });

        return codeLenses;
    }
}

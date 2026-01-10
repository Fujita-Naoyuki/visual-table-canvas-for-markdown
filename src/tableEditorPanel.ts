import * as vscode from 'vscode';
import { TableInfo } from './tableParser';

/**
 * Message types for communication between extension and webview
 */
export interface TableData {
    type: 'tableData';
    data: string[][];
    tableIndex: number;
}

export interface UpdateTable {
    type: 'updateTable';
    data: string[][];
}

export interface RequestSave {
    type: 'requestSave';
}

export interface SaveConfirmed {
    type: 'saveConfirmed';
    data: string[][];
}

export interface SaveCancelled {
    type: 'saveCancelled';
}

export type ExtensionToWebviewMessage = TableData;
export type WebviewToExtensionMessage = UpdateTable | SaveConfirmed | SaveCancelled;

/**
 * Manages the Webview Panel for table editing
 */
export class TableEditorPanel {
    public static currentPanels: Map<string, TableEditorPanel> = new Map();
    private static readonly viewType = 'visualTableCanvas.tableEditor';

    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private readonly _documentUri: vscode.Uri;
    private readonly _tableInfo: TableInfo;
    private readonly _tableIndex: number;
    private _disposables: vscode.Disposable[] = [];
    private _isDirty: boolean = false;
    private _currentData: string[][];

    public static createOrShow(
        extensionUri: vscode.Uri,
        documentUri: vscode.Uri,
        tableInfo: TableInfo,
        tableIndex: number
    ): TableEditorPanel {
        const key = `${documentUri.toString()}-${tableIndex}`;

        // If panel already exists, reveal it
        const existingPanel = TableEditorPanel.currentPanels.get(key);
        if (existingPanel) {
            existingPanel._panel.reveal(vscode.ViewColumn.Beside);
            return existingPanel;
        }

        // Create a new panel
        const panel = vscode.window.createWebviewPanel(
            TableEditorPanel.viewType,
            `Table Editor - Table ${tableIndex + 1}`,
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')]
            }
        );

        const tableEditorPanel = new TableEditorPanel(
            panel,
            extensionUri,
            documentUri,
            tableInfo,
            tableIndex
        );

        TableEditorPanel.currentPanels.set(key, tableEditorPanel);
        return tableEditorPanel;
    }

    private constructor(
        panel: vscode.WebviewPanel,
        extensionUri: vscode.Uri,
        documentUri: vscode.Uri,
        tableInfo: TableInfo,
        tableIndex: number
    ) {
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._documentUri = documentUri;
        this._tableInfo = tableInfo;
        this._tableIndex = tableIndex;
        this._currentData = JSON.parse(JSON.stringify(tableInfo.data));

        // Set the webview's initial html content
        this._update();

        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage(
            (message: WebviewToExtensionMessage) => {
                this._handleMessage(message);
            },
            null,
            this._disposables
        );

        // Handle panel disposal
        this._panel.onDidDispose(
            () => this._onDispose(),
            null,
            this._disposables
        );
    }

    private async _handleMessage(message: WebviewToExtensionMessage) {
        switch (message.type) {
            case 'updateTable':
                this._currentData = message.data;
                this._isDirty = true;
                break;
            case 'saveConfirmed':
                await this._saveToDocument(message.data);
                break;
            case 'saveCancelled':
                // User cancelled save, just close
                break;
        }
    }

    private async _onDispose() {
        const key = `${this._documentUri.toString()}-${this._tableIndex}`;
        TableEditorPanel.currentPanels.delete(key);

        if (this._isDirty) {
            const result = await vscode.window.showInformationMessage(
                'Table has been modified. Save changes?',
                { modal: true },
                'Save',
                'Don\'t Save'
            );

            if (result === 'Save') {
                await this._saveToDocument(this._currentData);
            }
        }

        // Clean up disposables
        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }

    private async _saveToDocument(data: string[][]) {
        const { tableToMarkdown } = await import('./tableParser');
        const newMarkdown = tableToMarkdown(data);

        const document = await vscode.workspace.openTextDocument(this._documentUri);
        const edit = new vscode.WorkspaceEdit();

        const startPos = new vscode.Position(this._tableInfo.startLine, 0);
        const endPos = new vscode.Position(
            this._tableInfo.endLine,
            document.lineAt(this._tableInfo.endLine).text.length
        );

        edit.replace(this._documentUri, new vscode.Range(startPos, endPos), newMarkdown);
        await vscode.workspace.applyEdit(edit);
        await document.save();

        this._isDirty = false;
        vscode.window.showInformationMessage('Table saved successfully!');
    }

    private _update() {
        this._panel.webview.html = this._getHtmlForWebview();

        // Send table data to webview
        setTimeout(() => {
            this._panel.webview.postMessage({
                type: 'tableData',
                data: this._tableInfo.data,
                tableIndex: this._tableIndex
            } as TableData);
        }, 100);
    }

    private _getHtmlForWebview(): string {
        const nonce = getNonce();

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Table Editor</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 10px;
            margin: 0;
        }
        .table-container {
            overflow: auto;
            max-width: 100%;
            max-height: calc(100vh - 60px);
        }
        table {
            border-collapse: collapse;
            user-select: none;
        }
        th, td {
            border: 1px solid var(--vscode-panel-border);
            padding: 4px 8px;
            min-width: 60px;
            text-align: left;
        }
        th {
            background-color: var(--vscode-editor-lineHighlightBackground);
            font-weight: normal;
            position: sticky;
            top: 0;
            z-index: 1;
        }
        .row-header {
            background-color: var(--vscode-editor-lineHighlightBackground);
            text-align: center;
            min-width: 40px;
            position: sticky;
            left: 0;
            z-index: 1;
            cursor: pointer;
        }
        .row-header:hover, .col-header:hover {
            background-color: var(--vscode-list-hoverBackground);
        }
        .row-header.selected, .col-header.selected {
            background-color: var(--vscode-editor-selectionBackground);
        }
        .col-header {
            cursor: pointer;
        }
        .corner-header {
            position: sticky;
            top: 0;
            left: 0;
            z-index: 2;
            background-color: var(--vscode-editor-lineHighlightBackground);
        }
        .cell {
            cursor: cell;
        }
        .cell:hover {
            background-color: var(--vscode-list-hoverBackground);
        }
        .cell.selected {
            background-color: var(--vscode-editor-selectionBackground);
        }
        .cell.active {
            outline: 2px solid var(--vscode-focusBorder);
            outline-offset: -2px;
        }
        .cell.editing {
            padding: 0;
        }
        .cell.editing input {
            width: 100%;
            height: 100%;
            border: none;
            padding: 4px 8px;
            font-family: inherit;
            font-size: inherit;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            outline: none;
            box-sizing: border-box;
        }
        .status-bar {
            margin-top: 10px;
            padding: 5px;
            background-color: var(--vscode-statusBar-background);
            color: var(--vscode-statusBar-foreground);
            font-size: 12px;
        }
    </style>
</head>
<body>
    <div class="table-container">
        <table id="table-grid">
            <thead id="table-header"></thead>
            <tbody id="table-body"></tbody>
        </table>
    </div>
    <div class="status-bar" id="status-bar">Loading...</div>
    
    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        
        let tableData = [];
        let isEditing = false;
        let isDragging = false;
        
        // Selection state
        let selection = {
            startRow: -1, startCol: -1,
            endRow: -1, endCol: -1,
            activeRow: -1, activeCol: -1,
            type: 'cell' // 'cell', 'row', 'column'
        };
        
        window.addEventListener('message', event => {
            const message = event.data;
            if (message.type === 'tableData') {
                tableData = message.data;
                renderTable();
                updateStatus('Ready');
            }
        });
        
        function renderTable() {
            const headerRow = document.getElementById('table-header');
            const tableBody = document.getElementById('table-body');
            
            if (!tableData || tableData.length === 0) {
                headerRow.innerHTML = '';
                tableBody.innerHTML = '<tr><td>No data</td></tr>';
                return;
            }
            
            const columnCount = Math.max(...tableData.map(row => row.length));
            
            let headerHtml = '<tr><th class="corner-header"></th>';
            for (let col = 0; col < columnCount; col++) {
                headerHtml += '<th class="col-header" data-col="' + col + '">' + getColumnName(col) + '</th>';
            }
            headerHtml += '</tr>';
            headerRow.innerHTML = headerHtml;
            
            let bodyHtml = '';
            for (let row = 0; row < tableData.length; row++) {
                bodyHtml += '<tr>';
                bodyHtml += '<td class="row-header" data-row="' + row + '">' + (row + 1) + '</td>';
                for (let col = 0; col < columnCount; col++) {
                    const value = tableData[row][col] || '';
                    bodyHtml += '<td class="cell" data-row="' + row + '" data-col="' + col + '">' + escapeHtml(value) + '</td>';
                }
                bodyHtml += '</tr>';
            }
            tableBody.innerHTML = bodyHtml;
            
            document.querySelectorAll('.cell').forEach(cell => {
                cell.addEventListener('mousedown', handleCellMouseDown);
                cell.addEventListener('mouseover', handleCellMouseOver);
                cell.addEventListener('dblclick', handleCellDoubleClick);
            });
            
            document.querySelectorAll('.row-header').forEach(header => {
                header.addEventListener('mousedown', handleRowHeaderMouseDown);
                header.addEventListener('mouseover', handleRowHeaderMouseOver);
            });
            
            document.querySelectorAll('.col-header').forEach(header => {
                header.addEventListener('mousedown', handleColHeaderMouseDown);
                header.addEventListener('mouseover', handleColHeaderMouseOver);
            });
        }
        
        document.addEventListener('mouseup', () => { isDragging = false; });
        
        function getColumnName(index) {
            let name = '';
            while (index >= 0) {
                name = String.fromCharCode(65 + (index % 26)) + name;
                index = Math.floor(index / 26) - 1;
            }
            return name;
        }
        
        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }
        
        function handleCellMouseDown(event) {
            if (isEditing) return;
            const cell = event.target.closest('.cell');
            if (!cell) return;
            
            const row = parseInt(cell.dataset.row);
            const col = parseInt(cell.dataset.col);
            
            isDragging = true;
            selection = {
                startRow: row, startCol: col,
                endRow: row, endCol: col,
                activeRow: row, activeCol: col,
                type: 'cell'
            };
            updateSelectionDisplay();
            event.preventDefault();
        }
        
        function handleCellMouseOver(event) {
            if (!isDragging || isEditing || selection.type !== 'cell') return;
            const cell = event.target.closest('.cell');
            if (!cell) return;
            
            selection.endRow = parseInt(cell.dataset.row);
            selection.endCol = parseInt(cell.dataset.col);
            updateSelectionDisplay();
        }
        
        function handleRowHeaderMouseDown(event) {
            if (isEditing) return;
            const header = event.target.closest('.row-header');
            if (!header) return;
            
            const row = parseInt(header.dataset.row);
            const columnCount = tableData[0]?.length || 0;
            
            isDragging = true;
            selection = {
                startRow: row, startCol: 0,
                endRow: row, endCol: columnCount - 1,
                activeRow: row, activeCol: 0,
                type: 'row'
            };
            updateSelectionDisplay();
            event.preventDefault();
        }
        
        function handleRowHeaderMouseOver(event) {
            if (!isDragging || selection.type !== 'row') return;
            const header = event.target.closest('.row-header');
            if (!header) return;
            
            const row = parseInt(header.dataset.row);
            selection.endRow = row;
            updateSelectionDisplay();
        }
        
        function handleColHeaderMouseDown(event) {
            if (isEditing) return;
            const header = event.target.closest('.col-header');
            if (!header) return;
            
            const col = parseInt(header.dataset.col);
            const rowCount = tableData.length;
            
            isDragging = true;
            selection = {
                startRow: 0, startCol: col,
                endRow: rowCount - 1, endCol: col,
                activeRow: 0, activeCol: col,
                type: 'column'
            };
            updateSelectionDisplay();
            event.preventDefault();
        }
        
        function handleColHeaderMouseOver(event) {
            if (!isDragging || selection.type !== 'column') return;
            const header = event.target.closest('.col-header');
            if (!header) return;
            
            const col = parseInt(header.dataset.col);
            selection.endCol = col;
            updateSelectionDisplay();
        }
        
        function handleCellDoubleClick(event) {
            const cell = event.target.closest('.cell');
            if (cell) startEditing(cell);
        }
        
        function updateSelectionDisplay() {
            document.querySelectorAll('.cell.selected, .cell.active').forEach(c => {
                c.classList.remove('selected', 'active');
            });
            document.querySelectorAll('.row-header.selected, .col-header.selected').forEach(h => {
                h.classList.remove('selected');
            });
            
            const minRow = Math.min(selection.startRow, selection.endRow);
            const maxRow = Math.max(selection.startRow, selection.endRow);
            const minCol = Math.min(selection.startCol, selection.endCol);
            const maxCol = Math.max(selection.startCol, selection.endCol);
            
            for (let row = minRow; row <= maxRow; row++) {
                for (let col = minCol; col <= maxCol; col++) {
                    const cell = document.querySelector('.cell[data-row="' + row + '"][data-col="' + col + '"]');
                    if (cell) cell.classList.add('selected');
                }
            }
            
            const activeCell = document.querySelector('.cell[data-row="' + selection.activeRow + '"][data-col="' + selection.activeCol + '"]');
            if (activeCell) activeCell.classList.add('active');
            
            if (selection.type === 'row') {
                for (let row = minRow; row <= maxRow; row++) {
                    const header = document.querySelector('.row-header[data-row="' + row + '"]');
                    if (header) header.classList.add('selected');
                }
            } else if (selection.type === 'column') {
                for (let col = minCol; col <= maxCol; col++) {
                    const header = document.querySelector('.col-header[data-col="' + col + '"]');
                    if (header) header.classList.add('selected');
                }
            }
            
            updateStatusFromSelection();
        }
        
        function updateStatusFromSelection() {
            const minRow = Math.min(selection.startRow, selection.endRow);
            const maxRow = Math.max(selection.startRow, selection.endRow);
            const minCol = Math.min(selection.startCol, selection.endCol);
            const maxCol = Math.max(selection.startCol, selection.endCol);
            
            if (minRow === maxRow && minCol === maxCol) {
                updateStatus('Selected: ' + getColumnName(minCol) + (minRow + 1));
            } else {
                updateStatus('Selected: ' + getColumnName(minCol) + (minRow + 1) + ':' + getColumnName(maxCol) + (maxRow + 1));
            }
        }
        
        function getActiveCell() {
            return document.querySelector('.cell[data-row="' + selection.activeRow + '"][data-col="' + selection.activeCol + '"]');
        }
        
        function selectSingleCell(row, col) {
            selection = {
                startRow: row, startCol: col,
                endRow: row, endCol: col,
                activeRow: row, activeCol: col,
                type: 'cell'
            };
            updateSelectionDisplay();
        }
        
        function startEditing(cell) {
            if (isEditing) return;
            
            isEditing = true;
            cell.classList.add('editing');
            
            const row = parseInt(cell.dataset.row);
            const col = parseInt(cell.dataset.col);
            const value = tableData[row][col] || '';
            
            selectSingleCell(row, col);
            
            cell.innerHTML = '<input type="text" value="' + escapeHtml(value).replace(/"/g, '&quot;') + '">';
            const input = cell.querySelector('input');
            input.focus();
            input.select();
            
            input.addEventListener('blur', () => finishEditing(cell, input.value));
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.altKey) {
                    e.preventDefault();
                    finishEditing(cell, input.value);
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    cancelEditing(cell);
                }
            });
            
            updateStatus('Editing: ' + getColumnName(col) + (row + 1));
        }
        
        function startEditingWithValue(cell, initialValue) {
            if (isEditing) return;
            
            isEditing = true;
            cell.classList.add('editing');
            
            const row = parseInt(cell.dataset.row);
            const col = parseInt(cell.dataset.col);
            
            selectSingleCell(row, col);
            
            cell.innerHTML = '<input type="text" value="' + escapeHtml(initialValue).replace(/"/g, '&quot;') + '">';
            const input = cell.querySelector('input');
            input.focus();
            input.setSelectionRange(input.value.length, input.value.length);
            
            input.addEventListener('blur', () => finishEditing(cell, input.value));
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.altKey) {
                    e.preventDefault();
                    finishEditing(cell, input.value);
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    cancelEditing(cell);
                }
            });
            
            updateStatus('Editing: ' + getColumnName(col) + (row + 1));
        }
        
        function finishEditing(cell, newValue) {
            if (!isEditing) return;
            
            const row = parseInt(cell.dataset.row);
            const col = parseInt(cell.dataset.col);
            
            tableData[row][col] = newValue;
            
            cell.classList.remove('editing');
            cell.innerHTML = escapeHtml(newValue);
            isEditing = false;
            
            vscode.postMessage({ type: 'updateTable', data: tableData });
            updateStatus('Modified');
        }
        
        function cancelEditing(cell) {
            if (!isEditing) return;
            
            const row = parseInt(cell.dataset.row);
            const col = parseInt(cell.dataset.col);
            const value = tableData[row][col] || '';
            
            cell.classList.remove('editing');
            cell.innerHTML = escapeHtml(value);
            isEditing = false;
            
            updateStatus('Ready');
        }
        
        function updateStatus(message) {
            document.getElementById('status-bar').textContent = message;
        }
        
        document.addEventListener('keydown', (e) => {
            if (isEditing) return;
            if (selection.activeRow < 0 || selection.activeCol < 0) return;
            
            const row = selection.activeRow;
            const col = selection.activeCol;
            let newRow = row;
            let newCol = col;
            
            switch (e.key) {
                case 'ArrowUp':
                    newRow = Math.max(0, row - 1);
                    e.preventDefault();
                    break;
                case 'ArrowDown':
                    newRow = Math.min(tableData.length - 1, row + 1);
                    e.preventDefault();
                    break;
                case 'ArrowLeft':
                    newCol = Math.max(0, col - 1);
                    e.preventDefault();
                    break;
                case 'ArrowRight':
                    newCol = Math.min(tableData[0].length - 1, col + 1);
                    e.preventDefault();
                    break;
                case 'Tab':
                    if (e.shiftKey) {
                        newCol = col - 1;
                        if (newCol < 0) {
                            newCol = tableData[0].length - 1;
                            newRow = Math.max(0, row - 1);
                        }
                    } else {
                        newCol = col + 1;
                        if (newCol >= tableData[0].length) {
                            newCol = 0;
                            newRow = Math.min(tableData.length - 1, row + 1);
                        }
                    }
                    e.preventDefault();
                    break;
                case 'Enter':
                    newRow = Math.min(tableData.length - 1, row + 1);
                    e.preventDefault();
                    break;
                case 'F2':
                    const activeCell = getActiveCell();
                    if (activeCell) startEditing(activeCell);
                    e.preventDefault();
                    return;
                default:
                    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
                        const activeCell = getActiveCell();
                        if (activeCell) {
                            startEditingWithValue(activeCell, e.key);
                            e.preventDefault();
                        }
                    }
                    return;
            }
            
            selectSingleCell(newRow, newCol);
        });
    </script>
</body>
</html>`;
    }
}

function getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

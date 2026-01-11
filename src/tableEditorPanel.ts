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

export interface WebviewReady {
    type: 'ready';
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

export interface SaveAndClose {
    type: 'saveAndClose';
    data: string[][];
}

export type ExtensionToWebviewMessage = TableData;
export type WebviewToExtensionMessage = UpdateTable | SaveConfirmed | SaveCancelled | SaveAndClose | WebviewReady;

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
            case 'ready':
                this._sendTableData();
                break;
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
            case 'saveAndClose':
                await this._saveToDocument(message.data);
                this._isDirty = false; // Prevent confirmation dialog
                this._panel.dispose();
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
    }

    private _sendTableData() {
        this._panel.webview.postMessage({
            type: 'tableData',
            data: this._tableInfo.data,
            tableIndex: this._tableIndex
        } as TableData);
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
        .cell.editing input, .cell.editing textarea {
            width: 100%;
            min-height: 24px;
            border: none;
            padding: 4px 8px;
            font-family: inherit;
            font-size: inherit;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            outline: none;
            box-sizing: border-box;
            resize: none;
            overflow: hidden;
        }
        .status-bar {
            margin-top: 10px;
            padding: 5px 10px;
            background-color: var(--vscode-statusBar-background);
            color: var(--vscode-statusBar-foreground);
            font-size: 12px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .status-text {
            flex: 1;
        }
        .save-btn {
            padding: 4px 12px;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 3px;
            cursor: pointer;
            font-size: 12px;
        }
        .save-btn:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        .save-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        .context-menu {
            display: none;
            position: fixed;
            background-color: var(--vscode-menu-background);
            border: 1px solid var(--vscode-menu-border);
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            z-index: 1000;
            min-width: 150px;
            padding: 4px 0;
        }
        .context-menu.visible {
            display: block;
        }
        .context-menu-item {
            padding: 6px 12px;
            cursor: pointer;
            color: var(--vscode-menu-foreground);
        }
        .context-menu-item:hover {
            background-color: var(--vscode-menu-selectionBackground);
            color: var(--vscode-menu-selectionForeground);
        }
        .context-menu-separator {
            height: 1px;
            background-color: var(--vscode-menu-separatorBackground);
            margin: 4px 0;
        }
        .dialog-overlay {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0,0,0,0.5);
            z-index: 2000;
            align-items: center;
            justify-content: center;
        }
        .dialog-overlay.visible {
            display: flex;
        }
        .dialog {
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            padding: 20px;
            border-radius: 4px;
            min-width: 250px;
        }
        .dialog-title {
            font-weight: bold;
            margin-bottom: 15px;
        }
        .dialog-content {
            margin-bottom: 15px;
        }
        .dialog-content select {
            width: 100%;
            padding: 6px;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
        }
        .dialog-buttons {
            display: flex;
            justify-content: flex-end;
            gap: 8px;
        }
        .dialog-btn {
            padding: 6px 12px;
            border: 1px solid var(--vscode-button-border);
            cursor: pointer;
        }
        .dialog-btn-primary {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }
        .dialog-btn-secondary {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
    </style>
</head>
<body>
    <div class="table-container" id="table-container" tabindex="0" style="outline: none;">
        <table id="table-grid">
            <thead id="table-header"></thead>
            <tbody id="table-body"></tbody>
        </table>
    </div>
    <div class="status-bar">
        <span class="status-text" id="status-bar">Loading...</span>
        <button class="save-btn" id="save-btn" disabled>Save & Close</button>
    </div>
    <div class="context-menu" id="context-menu"></div>
    <div class="dialog-overlay" id="dialog-overlay">
        <div class="dialog">
            <div class="dialog-title" id="dialog-title"></div>
            <div class="dialog-content">
                <select id="dialog-select"></select>
            </div>
            <div class="dialog-buttons">
                <button class="dialog-btn dialog-btn-secondary" id="dialog-cancel">Cancel</button>
                <button class="dialog-btn dialog-btn-primary" id="dialog-ok">OK</button>
            </div>
        </div>
    </div>
    
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
        
        // Undo stack
        const undoStack = [];
        const MAX_UNDO_STACK = 50;
        
        function saveUndoState() {
            // Deep copy of tableData
            const snapshot = tableData.map(row => [...row]);
            undoStack.push(snapshot);
            if (undoStack.length > MAX_UNDO_STACK) {
                undoStack.shift();
            }
        }
        
        function undo() {
            if (undoStack.length === 0) {
                updateStatus('Nothing to undo');
                return;
            }
            tableData = undoStack.pop();
            notifyChange();
            renderTable();
            updateStatus('Undo');
        }
        
        // Notify extension that webview is ready
        vscode.postMessage({ type: 'ready' });
        
        window.addEventListener('message', event => {
            const message = event.data;
            console.log('Received message:', message);
            try {
                if (message.type === 'tableData') {
                    tableData = message.data;
                    renderTable();
                    updateStatus('Ready');
                }
            } catch (e) {
                console.error('Error handling message:', e);
                updateStatus('Error: ' + e.message);
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
                header.addEventListener('contextmenu', handleRowHeaderContextMenu);
            });
            
            document.querySelectorAll('.col-header').forEach(header => {
                header.addEventListener('mousedown', handleColHeaderMouseDown);
                header.addEventListener('mouseover', handleColHeaderMouseOver);
                header.addEventListener('contextmenu', handleColHeaderContextMenu);
            });
            
            // Focus the table container to enable keyboard navigation
            document.getElementById('table-container').focus();
            
            // Auto-select first cell if nothing is selected
            if (selection.activeRow < 0 && tableData.length > 0) {
                selectSingleCell(0, 0);
            }
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
            if (event.button === 2) return; // Skip right-click, let contextmenu handle it
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
            if (event.button === 2) return; // Skip right-click, let contextmenu handle it
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
            
            cell.innerHTML = '<textarea rows="1">' + escapeHtml(value) + '</textarea>';
            const textarea = cell.querySelector('textarea');
            textarea.focus();
            textarea.select();
            autoResizeTextarea(textarea);
            
            let isCancelled = false;
            
            textarea.addEventListener('blur', () => {
                if (!isCancelled) {
                    finishEditing(cell, textarea.value);
                }
            });
            textarea.addEventListener('input', () => autoResizeTextarea(textarea));
            textarea.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && e.altKey) {
                    // Alt+Enter: insert <br>
                    e.preventDefault();
                    const start = textarea.selectionStart;
                    const end = textarea.selectionEnd;
                    textarea.value = textarea.value.substring(0, start) + '<br>' + textarea.value.substring(end);
                    textarea.selectionStart = textarea.selectionEnd = start + 4;
                } else if (e.key === 'Enter' && !e.altKey) {
                    e.preventDefault();
                    finishEditing(cell, textarea.value);
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    isCancelled = true;
                    cancelEditing(cell);
                }
            });
            
            updateStatus('Editing: ' + getColumnName(col) + (row + 1) + ' (Alt+Enter for <br>)');
        }
        
        function autoResizeTextarea(textarea) {
            textarea.style.height = 'auto';
            textarea.style.height = textarea.scrollHeight + 'px';
        }
        
        function startEditingWithValue(cell, initialValue) {
            if (isEditing) return;
            
            isEditing = true;
            cell.classList.add('editing');
            
            const row = parseInt(cell.dataset.row);
            const col = parseInt(cell.dataset.col);
            
            selectSingleCell(row, col);
            
            cell.innerHTML = '<textarea rows="1">' + escapeHtml(initialValue) + '</textarea>';
            const textarea = cell.querySelector('textarea');
            textarea.focus();
            textarea.setSelectionRange(textarea.value.length, textarea.value.length);
            autoResizeTextarea(textarea);
            
            let isCancelled = false;
            
            textarea.addEventListener('blur', () => {
                if (!isCancelled) {
                    finishEditing(cell, textarea.value);
                }
            });
            textarea.addEventListener('input', () => autoResizeTextarea(textarea));
            textarea.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && e.altKey) {
                    // Alt+Enter: insert <br>
                    e.preventDefault();
                    const start = textarea.selectionStart;
                    const end = textarea.selectionEnd;
                    textarea.value = textarea.value.substring(0, start) + '<br>' + textarea.value.substring(end);
                    textarea.selectionStart = textarea.selectionEnd = start + 4;
                } else if (e.key === 'Enter' && !e.altKey) {
                    e.preventDefault();
                    finishEditing(cell, textarea.value);
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    isCancelled = true;
                    cancelEditing(cell);
                }
            });
            
            updateStatus('Editing: ' + getColumnName(col) + (row + 1) + ' (Alt+Enter for <br>)');
        }
        
        function finishEditing(cell, newValue) {
            if (!isEditing) return;
            if (!cell.classList.contains('editing')) return;
            
            const row = parseInt(cell.dataset.row);
            const col = parseInt(cell.dataset.col);
            
            saveUndoState();
            tableData[row][col] = newValue;
            
            cell.classList.remove('editing');
            cell.innerHTML = escapeHtml(newValue);
            isEditing = false;
            
            vscode.postMessage({ type: 'updateTable', data: tableData });
            updateStatus('Modified');
        }
        
        function cancelEditing(cell) {
            if (!isEditing) return;
            if (!cell.classList.contains('editing')) return;
            
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
                case 'Delete':
                case 'Backspace':
                    // Clear selected cells
                    const minRow = Math.min(selection.startRow, selection.endRow);
                    const maxRow = Math.max(selection.startRow, selection.endRow);
                    const minCol = Math.min(selection.startCol, selection.endCol);
                    const maxCol = Math.max(selection.startCol, selection.endCol);
                    
                    if (minRow >= 0 && minCol >= 0) {
                        saveUndoState();
                        for (let r = minRow; r <= maxRow; r++) {
                            for (let c = minCol; c <= maxCol; c++) {
                                tableData[r][c] = '';
                            }
                        }
                        notifyChange();
                        renderTable();
                        updateStatus('Cleared ' + (maxRow - minRow + 1) + 'x' + (maxCol - minCol + 1) + ' cells');
                    }
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
        
        // Cell copy/paste handling
        let copiedCells = null;
        let copiedCellsRows = 0;
        let copiedCellsCols = 0;
        
        document.addEventListener('keydown', (e) => {
            if (isEditing) return;
            
            // Ctrl+Z: Undo
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                undo();
                e.preventDefault();
                return;
            }
            
            // Ctrl+C: Copy selected cells or rows/columns
            if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
                const minRow = Math.min(selection.startRow, selection.endRow);
                const maxRow = Math.max(selection.startRow, selection.endRow);
                const minCol = Math.min(selection.startCol, selection.endCol);
                const maxCol = Math.max(selection.startCol, selection.endCol);
                
                if (selection.type === 'row') {
                    // Copy rows
                    copiedRows = [];
                    for (let r = minRow; r <= maxRow; r++) {
                        copiedRows.push([...tableData[r]]);
                    }
                    copiedCols = null;
                    copiedCells = null;
                    updateStatus('Copied ' + copiedRows.length + ' row(s)');
                    e.preventDefault();
                    return;
                }
                
                if (selection.type === 'column') {
                    // Copy columns
                    copiedCols = [];
                    for (let c = minCol; c <= maxCol; c++) {
                        const colData = tableData.map(row => row[c] || '');
                        copiedCols.push(colData);
                    }
                    copiedRows = null;
                    copiedCells = null;
                    updateStatus('Copied ' + copiedCols.length + ' column(s)');
                    e.preventDefault();
                    return;
                }
                
                // Copy cells
                copiedCells = [];
                for (let r = minRow; r <= maxRow; r++) {
                    const rowData = [];
                    for (let c = minCol; c <= maxCol; c++) {
                        rowData.push(tableData[r][c] || '');
                    }
                    copiedCells.push(rowData);
                }
                copiedCellsRows = maxRow - minRow + 1;
                copiedCellsCols = maxCol - minCol + 1;
                copiedRows = null;
                copiedCols = null;
                
                updateStatus('Copied ' + copiedCellsRows + 'x' + copiedCellsCols + ' cells');
                e.preventDefault();
                return;
            }
            
            // Ctrl+V: Paste cells or rows/columns
            if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
                const minRow = Math.min(selection.startRow, selection.endRow);
                const maxRow = Math.max(selection.startRow, selection.endRow);
                const minCol = Math.min(selection.startCol, selection.endCol);
                const maxCol = Math.max(selection.startCol, selection.endCol);
                
                // Paste rows
                if (selection.type === 'row' && copiedRows && copiedRows.length > 0) {
                    const selRowCount = maxRow - minRow + 1;
                    const copyRowCount = copiedRows.length;
                    
                    // Single row copied -> apply to all selected rows
                    if (copyRowCount === 1) {
                        saveUndoState();
                        for (let r = minRow; r <= maxRow; r++) {
                            for (let c = 0; c < copiedRows[0].length && c < tableData[r].length; c++) {
                                tableData[r][c] = copiedRows[0][c];
                            }
                        }
                        notifyChange();
                        renderTable();
                        updateStatus('Pasted to ' + selRowCount + ' row(s)');
                    }
                    // Single row selected + multiple rows copied -> paste from start point
                    else if (selRowCount === 1) {
                        saveUndoState();
                        for (let i = 0; i < copyRowCount && (minRow + i) < tableData.length; i++) {
                            for (let c = 0; c < copiedRows[i].length && c < tableData[minRow + i].length; c++) {
                                tableData[minRow + i][c] = copiedRows[i][c];
                            }
                        }
                        notifyChange();
                        renderTable();
                        updateStatus('Pasted ' + copyRowCount + ' row(s)');
                    }
                    // Same size -> paste directly
                    else if (selRowCount === copyRowCount) {
                        saveUndoState();
                        for (let i = 0; i < copyRowCount; i++) {
                            for (let c = 0; c < copiedRows[i].length && c < tableData[minRow + i].length; c++) {
                                tableData[minRow + i][c] = copiedRows[i][c];
                            }
                        }
                        notifyChange();
                        renderTable();
                        updateStatus('Pasted ' + copyRowCount + ' row(s)');
                    }
                    // Different size -> error
                    else {
                        updateStatus('Error: Selection (' + selRowCount + ' rows) does not match copied (' + copyRowCount + ' rows)');
                    }
                    e.preventDefault();
                    return;
                }
                
                // Paste columns
                if (selection.type === 'column' && copiedCols && copiedCols.length > 0) {
                    const selColCount = maxCol - minCol + 1;
                    const copyColCount = copiedCols.length;
                    
                    // Single column copied -> apply to all selected columns
                    if (copyColCount === 1) {
                        saveUndoState();
                        for (let c = minCol; c <= maxCol; c++) {
                            for (let r = 0; r < copiedCols[0].length && r < tableData.length; r++) {
                                tableData[r][c] = copiedCols[0][r];
                            }
                        }
                        notifyChange();
                        renderTable();
                        updateStatus('Pasted to ' + selColCount + ' column(s)');
                    }
                    // Single column selected + multiple columns copied -> paste from start point
                    else if (selColCount === 1) {
                        saveUndoState();
                        for (let i = 0; i < copyColCount && (minCol + i) < tableData[0].length; i++) {
                            for (let r = 0; r < copiedCols[i].length && r < tableData.length; r++) {
                                tableData[r][minCol + i] = copiedCols[i][r];
                            }
                        }
                        notifyChange();
                        renderTable();
                        updateStatus('Pasted ' + copyColCount + ' column(s)');
                    }
                    // Same size -> paste directly
                    else if (selColCount === copyColCount) {
                        saveUndoState();
                        for (let i = 0; i < copyColCount; i++) {
                            for (let r = 0; r < copiedCols[i].length && r < tableData.length; r++) {
                                tableData[r][minCol + i] = copiedCols[i][r];
                            }
                        }
                        notifyChange();
                        renderTable();
                        updateStatus('Pasted ' + copyColCount + ' column(s)');
                    }
                    // Different size -> error
                    else {
                        updateStatus('Error: Selection (' + selColCount + ' columns) does not match copied (' + copyColCount + ' columns)');
                    }
                    e.preventDefault();
                    return;
                }
                
                // Row/column selection but wrong copied type
                if (selection.type === 'row' || selection.type === 'column') {
                    updateStatus('Nothing to paste (copy rows/columns first)');
                    e.preventDefault();
                    return;
                }
                
                // Paste cells
                if (!copiedCells || copiedCells.length === 0) {
                    updateStatus('Nothing to paste');
                    e.preventDefault();
                    return;
                }
                
                const selRows = maxRow - minRow + 1;
                const selCols = maxCol - minCol + 1;
                
                // Single cell copied -> apply to all selected cells
                if (copiedCellsRows === 1 && copiedCellsCols === 1) {
                    saveUndoState();
                    const value = copiedCells[0][0];
                    for (let r = minRow; r <= maxRow; r++) {
                        for (let c = minCol; c <= maxCol; c++) {
                            tableData[r][c] = value;
                        }
                    }
                    notifyChange();
                    renderTable();
                    updateStatus('Pasted to ' + selRows + 'x' + selCols + ' cells');
                }
                // Single cell selected + multiple cells copied -> paste from start point
                else if (selRows === 1 && selCols === 1) {
                    saveUndoState();
                    for (let r = 0; r < copiedCellsRows; r++) {
                        for (let c = 0; c < copiedCellsCols; c++) {
                            const targetRow = minRow + r;
                            const targetCol = minCol + c;
                            if (targetRow < tableData.length && targetCol < tableData[0].length) {
                                tableData[targetRow][targetCol] = copiedCells[r][c];
                            }
                        }
                    }
                    notifyChange();
                    renderTable();
                    updateStatus('Pasted ' + copiedCellsRows + 'x' + copiedCellsCols + ' cells');
                }
                // Same size selection and copied -> paste directly
                else if (selRows === copiedCellsRows && selCols === copiedCellsCols) {
                    saveUndoState();
                    for (let r = 0; r < copiedCellsRows; r++) {
                        for (let c = 0; c < copiedCellsCols; c++) {
                            tableData[minRow + r][minCol + c] = copiedCells[r][c];
                        }
                    }
                    notifyChange();
                    renderTable();
                    updateStatus('Pasted ' + copiedCellsRows + 'x' + copiedCellsCols + ' cells');
                }
                // Different size -> error
                else {
                    updateStatus('Error: Selection size (' + selRows + 'x' + selCols + ') does not match copied size (' + copiedCellsRows + 'x' + copiedCellsCols + ')');
                }
                
                e.preventDefault();
                return;
            }
        });
        
        // Context menu handling
        let copiedRows = null;
        let copiedCols = null;
        
        function hideContextMenu() {
            document.getElementById('context-menu').classList.remove('visible');
        }
        
        document.addEventListener('click', hideContextMenu);
        
        function showContextMenu(x, y, items) {
            const menu = document.getElementById('context-menu');
            menu.innerHTML = items.map(item => {
                if (item.separator) {
                    return '<div class="context-menu-separator"></div>';
                }
                return '<div class="context-menu-item" data-action="' + item.action + '">' + item.label + '</div>';
            }).join('');
            
            menu.style.left = x + 'px';
            menu.style.top = y + 'px';
            menu.classList.add('visible');
            
            menu.querySelectorAll('.context-menu-item').forEach(menuItem => {
                menuItem.addEventListener('click', (e) => {
                    const action = e.target.dataset.action;
                    executeMenuAction(action);
                    hideContextMenu();
                });
            });
        }
        
        function handleRowHeaderContextMenu(event) {
            event.preventDefault();
            if (isEditing) return;
            
            const header = event.target.closest('.row-header');
            if (!header) return;
            
            const row = parseInt(header.dataset.row);
            
            // Select the row if not already selected
            if (selection.type !== 'row' || row < Math.min(selection.startRow, selection.endRow) || row > Math.max(selection.startRow, selection.endRow)) {
                const columnCount = tableData[0]?.length || 0;
                selection = {
                    startRow: row, startCol: 0,
                    endRow: row, endCol: columnCount - 1,
                    activeRow: row, activeCol: 0,
                    type: 'row'
                };
                updateSelectionDisplay();
            }
            const minRow = Math.min(selection.startRow, selection.endRow);
            const maxRow = Math.max(selection.startRow, selection.endRow);
            const isSingleRow = minRow === maxRow;
            
            const items = [
                { label: isSingleRow ? 'Delete Row' : 'Delete Rows', action: 'deleteRows' }
            ];
            
            // Only show insert copied rows if there are copied rows
            if (copiedRows && copiedRows.length > 0) {
                items.push({ separator: true });
                items.push({ label: 'Insert Copied Row(s)', action: 'pasteRows' });
            }
            
            // Only show insert options for single row selection
            if (isSingleRow) {
                items.splice(1, 0, { separator: true });
                items.splice(2, 0, { label: 'Insert Row Above', action: 'insertRowAbove' });
                items.splice(3, 0, { label: 'Insert Row Below', action: 'insertRowBelow' });
            }
            
            showContextMenu(event.clientX, event.clientY, items);
        }
        
        function handleColHeaderContextMenu(event) {
            event.preventDefault();
            if (isEditing) return;
            
            const header = event.target.closest('.col-header');
            if (!header) return;
            
            const col = parseInt(header.dataset.col);
            
            // Select the column if not already selected
            if (selection.type !== 'column' || col < Math.min(selection.startCol, selection.endCol) || col > Math.max(selection.startCol, selection.endCol)) {
                const rowCount = tableData.length;
                selection = {
                    startRow: 0, startCol: col,
                    endRow: rowCount - 1, endCol: col,
                    activeRow: 0, activeCol: col,
                    type: 'column'
                };
                updateSelectionDisplay();
            }
            const minCol = Math.min(selection.startCol, selection.endCol);
            const maxCol = Math.max(selection.startCol, selection.endCol);
            const isSingleCol = minCol === maxCol;
            
            const items = [
                { label: isSingleCol ? 'Delete Column' : 'Delete Columns', action: 'deleteCols' }
            ];
            
            // Only show insert copied columns if there are copied columns
            if (copiedCols && copiedCols.length > 0) {
                items.push({ separator: true });
                items.push({ label: 'Insert Copied Column(s)', action: 'pasteCols' });
            }
            
            // Only show insert options for single column selection
            if (isSingleCol) {
                items.splice(1, 0, { separator: true });
                items.splice(2, 0, { label: 'Insert Column Left', action: 'insertColLeft' });
                items.splice(3, 0, { label: 'Insert Column Right', action: 'insertColRight' });
            }
            
            showContextMenu(event.clientX, event.clientY, items);
        }
        
        function executeMenuAction(action) {
            const minRow = Math.min(selection.startRow, selection.endRow);
            const maxRow = Math.max(selection.startRow, selection.endRow);
            const minCol = Math.min(selection.startCol, selection.endCol);
            const maxCol = Math.max(selection.startCol, selection.endCol);
            
            switch (action) {
                case 'deleteRows':
                    if (tableData.length > 1) {
                        saveUndoState();
                        tableData.splice(minRow, maxRow - minRow + 1);
                        notifyChange();
                        renderTable();
                        selectSingleCell(Math.min(minRow, tableData.length - 1), 0);
                    }
                    break;
                case 'insertRowAbove':
                    showInsertDialog('Insert Rows Above', 'row', 10 - tableData.length, (count) => {
                        saveUndoState();
                        for (let i = 0; i < count; i++) {
                            const newRow = new Array(tableData[0].length).fill('');
                            tableData.splice(minRow, 0, newRow);
                        }
                        notifyChange();
                        renderTable();
                        selectSingleCell(minRow, 0);
                    });
                    break;
                case 'insertRowBelow':
                    showInsertDialog('Insert Rows Below', 'row', 10 - tableData.length, (count) => {
                        saveUndoState();
                        for (let i = 0; i < count; i++) {
                            const newRow = new Array(tableData[0].length).fill('');
                            tableData.splice(maxRow + 1 + i, 0, newRow);
                        }
                        notifyChange();
                        renderTable();
                        selectSingleCell(maxRow + 1, 0);
                    });
                    break;
                case 'pasteRows':
                    if (copiedRows && copiedRows.length > 0) {
                        saveUndoState();
                        for (let i = 0; i < copiedRows.length; i++) {
                            tableData.splice(maxRow + 1 + i, 0, [...copiedRows[i]]);
                        }
                        notifyChange();
                        renderTable();
                        selectSingleCell(maxRow + 1, 0);
                    }
                    break;
                case 'deleteCols':
                    if (tableData[0].length > 1) {
                        saveUndoState();
                        for (let r = 0; r < tableData.length; r++) {
                            tableData[r].splice(minCol, maxCol - minCol + 1);
                        }
                        notifyChange();
                        renderTable();
                        selectSingleCell(0, Math.min(minCol, tableData[0].length - 1));
                    }
                    break;
                case 'insertColLeft':
                    showInsertDialog('Insert Columns Left', 'column', 10 - tableData[0].length, (count) => {
                        saveUndoState();
                        for (let r = 0; r < tableData.length; r++) {
                            for (let i = 0; i < count; i++) {
                                tableData[r].splice(minCol, 0, '');
                            }
                        }
                        notifyChange();
                        renderTable();
                        selectSingleCell(0, minCol);
                    });
                    break;
                case 'insertColRight':
                    showInsertDialog('Insert Columns Right', 'column', 10 - tableData[0].length, (count) => {
                        saveUndoState();
                        for (let r = 0; r < tableData.length; r++) {
                            for (let i = 0; i < count; i++) {
                                tableData[r].splice(maxCol + 1 + i, 0, '');
                            }
                        }
                        notifyChange();
                        renderTable();
                        selectSingleCell(0, maxCol + 1);
                    });
                    break;
                case 'pasteCols':
                    if (copiedCols && copiedCols.length > 0) {
                        saveUndoState();
                        for (let i = 0; i < copiedCols.length; i++) {
                            for (let r = 0; r < tableData.length; r++) {
                                tableData[r].splice(maxCol + 1 + i, 0, copiedCols[i][r] || '');
                            }
                        }
                        notifyChange();
                        renderTable();
                        selectSingleCell(0, maxCol + 1);
                    }
                    break;
            }
        }
        
        let dialogCallback = null;
        
        function showInsertDialog(title, type, maxCount, callback) {
            if (maxCount <= 0) {
                updateStatus('Cannot insert: maximum ' + (type === 'row' ? 'rows' : 'columns') + ' (10) reached');
                return;
            }
            
            const overlay = document.getElementById('dialog-overlay');
            const titleEl = document.getElementById('dialog-title');
            const selectEl = document.getElementById('dialog-select');
            
            titleEl.textContent = title;
            
            // Populate select options (1 to maxCount, max 10)
            const limit = Math.min(maxCount, 10);
            selectEl.innerHTML = '';
            for (let i = 1; i <= limit; i++) {
                selectEl.innerHTML += '<option value="' + i + '">' + i + '</option>';
            }
            
            dialogCallback = callback;
            overlay.classList.add('visible');
        }
        
        document.getElementById('dialog-ok').addEventListener('click', () => {
            const count = parseInt(document.getElementById('dialog-select').value);
            document.getElementById('dialog-overlay').classList.remove('visible');
            if (dialogCallback && count > 0) {
                dialogCallback(count);
            }
            dialogCallback = null;
        });
        
        document.getElementById('dialog-cancel').addEventListener('click', () => {
            document.getElementById('dialog-overlay').classList.remove('visible');
            dialogCallback = null;
        });
        
        function notifyChange() {
            vscode.postMessage({ type: 'updateTable', data: tableData });
            document.getElementById('save-btn').disabled = false;
        }
        
        // Save button handler
        document.getElementById('save-btn').addEventListener('click', () => {
            vscode.postMessage({ type: 'saveAndClose', data: tableData });
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

/**
 * Represents a parsed Markdown table
 */
export interface TableInfo {
    /** Starting line number (0-indexed) */
    startLine: number;
    /** Ending line number (0-indexed, inclusive) */
    endLine: number;
    /** Table data as 2D array */
    data: string[][];
    /** Original markdown text */
    rawText: string;
}

/**
 * Parses a single table row and extracts cell values
 */
export function parseTableRow(line: string): string[] | null {
    const trimmed = line.trim();

    // Table rows must start and end with |
    if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) {
        return null;
    }

    // Remove leading and trailing |, then split by | (but not \|)
    const content = trimmed.slice(1, -1);

    // Use a placeholder for escaped pipes to preserve them during split
    const PIPE_PLACEHOLDER = '\x00PIPE\x00';
    const escaped = content.replace(/\\\|/g, PIPE_PLACEHOLDER);
    const cells = escaped.split('|').map(cell => {
        // Restore escaped pipes and trim
        return cell.replace(new RegExp(PIPE_PLACEHOLDER, 'g'), '|').trim();
    });

    return cells;
}

/**
 * Checks if a line is a separator row (e.g., |---|---|)
 */
export function isSeparatorRow(line: string): boolean {
    const trimmed = line.trim();

    if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) {
        return false;
    }

    const content = trimmed.slice(1, -1);
    const cells = content.split('|');

    // Each cell should only contain dashes, colons, and spaces
    return cells.every(cell => /^[\s:-]+$/.test(cell) && cell.includes('-'));
}

/**
 * Checks if a line is a valid table row
 */
export function isTableRow(line: string): boolean {
    const trimmed = line.trim();
    return trimmed.startsWith('|') && trimmed.endsWith('|');
}

/**
 * Parses all Markdown tables in the given document text
 */
export function parseMarkdownTables(text: string): TableInfo[] {
    const lines = text.split('\n');
    const tables: TableInfo[] = [];

    let i = 0;
    while (i < lines.length) {
        // Look for potential table start (a line with |)
        if (!isTableRow(lines[i])) {
            i++;
            continue;
        }

        // Check if this could be a table header followed by separator
        const headerRow = parseTableRow(lines[i]);
        if (!headerRow) {
            i++;
            continue;
        }

        // Next line should be separator
        if (i + 1 >= lines.length || !isSeparatorRow(lines[i + 1])) {
            i++;
            continue;
        }

        // Found a valid table start
        const startLine = i;
        const tableData: string[][] = [headerRow];

        // Skip header and separator
        i += 2;

        // Parse remaining data rows
        while (i < lines.length && isTableRow(lines[i]) && !isSeparatorRow(lines[i])) {
            const row = parseTableRow(lines[i]);
            if (row) {
                tableData.push(row);
            }
            i++;
        }

        const endLine = i - 1;
        const rawText = lines.slice(startLine, endLine + 1).join('\n');

        tables.push({
            startLine,
            endLine,
            data: tableData,
            rawText
        });
    }

    return tables;
}

/**
 * Escapes pipe characters in cell content for Markdown table output
 */
function escapePipeInCell(value: string): string {
    return value.replace(/\|/g, '\\|');
}

/**
 * Converts table data back to Markdown format
 */
export function tableToMarkdown(data: string[][]): string {
    if (data.length === 0) {
        return '';
    }

    // Calculate max width for each column (after escaping)
    const columnCount = Math.max(...data.map(row => row.length));
    const columnWidths: number[] = [];

    for (let col = 0; col < columnCount; col++) {
        let maxWidth = 3; // Minimum width of 3 for separator
        for (const row of data) {
            if (col < row.length) {
                const escaped = escapePipeInCell(row[col]);
                maxWidth = Math.max(maxWidth, escaped.length);
            }
        }
        columnWidths.push(maxWidth);
    }

    const lines: string[] = [];

    for (let rowIndex = 0; rowIndex < data.length; rowIndex++) {
        const row = data[rowIndex];
        const cells: string[] = [];

        for (let col = 0; col < columnCount; col++) {
            const cellValue = col < row.length ? row[col] : '';
            const escaped = escapePipeInCell(cellValue);
            cells.push(escaped.padEnd(columnWidths[col]));
        }

        lines.push('| ' + cells.join(' | ') + ' |');

        // Add separator after header row
        if (rowIndex === 0) {
            const separator = columnWidths.map(w => '-'.repeat(w)).join(' | ');
            lines.push('| ' + separator + ' |');
        }
    }

    return lines.join('\n');
}

/**
 * Converts table data back to Markdown format, preserving original formatting for unchanged rows.
 * This minimizes diffs when saving tables.
 */
export function tableToMarkdownPreserveFormat(data: string[][], originalRawText: string, originalData: string[][]): string {
    if (data.length === 0) {
        return '';
    }

    // Parse original lines (skip separator which is at index 1)
    const originalLines = originalRawText.split('\n');
    const originalDataLines: string[] = [];
    for (let i = 0; i < originalLines.length; i++) {
        if (i === 1) continue; // Skip separator row
        if (isTableRow(originalLines[i]) && !isSeparatorRow(originalLines[i])) {
            originalDataLines.push(originalLines[i]);
        }
    }

    // Get original separator line
    const originalSeparator = originalLines.length > 1 ? originalLines[1] : null;

    // Check if column count changed
    const newColumnCount = Math.max(...data.map(row => row.length));
    const originalColumnCount = originalData.length > 0 ? Math.max(...originalData.map(row => row.length)) : 0;
    const columnCountChanged = newColumnCount !== originalColumnCount;

    // If column count changed, regenerate everything
    if (columnCountChanged) {
        return tableToMarkdown(data);
    }

    // Helper function to check if a row's data matches original
    function rowMatchesOriginal(rowIndex: number): boolean {
        if (rowIndex >= originalData.length) return false;
        const newRow = data[rowIndex];
        const origRow = originalData[rowIndex];
        if (newRow.length !== origRow.length) return false;
        return newRow.every((cell, i) => cell === origRow[i]);
    }

    // Helper function to format a single row with minimal padding
    function formatRow(row: string[]): string {
        const cells = row.map(cell => ` ${escapePipeInCell(cell)} `);
        return '|' + cells.join('|') + '|';
    }

    const lines: string[] = [];

    for (let rowIndex = 0; rowIndex < data.length; rowIndex++) {
        if (rowMatchesOriginal(rowIndex) && rowIndex < originalDataLines.length) {
            // Use original line formatting
            lines.push(originalDataLines[rowIndex]);
        } else {
            // Format the changed row with minimal padding
            lines.push(formatRow(data[rowIndex]));
        }

        // Add separator after header row
        if (rowIndex === 0) {
            if (originalSeparator && !columnCountChanged) {
                lines.push(originalSeparator);
            } else {
                // Generate new separator
                const separator = data[0].map(() => '---').join(' | ');
                lines.push('| ' + separator + ' |');
            }
        }
    }

    return lines.join('\n');
}


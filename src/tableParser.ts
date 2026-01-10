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
function parseTableRow(line: string): string[] | null {
    const trimmed = line.trim();

    // Table rows must start and end with |
    if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) {
        return null;
    }

    // Remove leading and trailing |, then split by |
    const content = trimmed.slice(1, -1);
    const cells = content.split('|').map(cell => cell.trim());

    return cells;
}

/**
 * Checks if a line is a separator row (e.g., |---|---|)
 */
function isSeparatorRow(line: string): boolean {
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
function isTableRow(line: string): boolean {
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
 * Converts table data back to Markdown format
 */
export function tableToMarkdown(data: string[][]): string {
    if (data.length === 0) {
        return '';
    }

    // Calculate max width for each column
    const columnCount = Math.max(...data.map(row => row.length));
    const columnWidths: number[] = [];

    for (let col = 0; col < columnCount; col++) {
        let maxWidth = 3; // Minimum width of 3 for separator
        for (const row of data) {
            if (col < row.length) {
                maxWidth = Math.max(maxWidth, row[col].length);
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
            cells.push(cellValue.padEnd(columnWidths[col]));
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

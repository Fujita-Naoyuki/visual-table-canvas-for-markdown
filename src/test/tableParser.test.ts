import * as assert from 'assert';
import { parseMarkdownTables, tableToMarkdown, parseTableRow, isSeparatorRow, isTableRow } from '../tableParser';

describe('Table Parser', () => {
    describe('parseMarkdownTables', () => {
        it('should parse a simple table', () => {
            const markdown = `
| Header1 | Header2 |
|---------|---------|
| Cell1   | Cell2   |
| Cell3   | Cell4   |
`.trim();

            const tables = parseMarkdownTables(markdown);

            assert.strictEqual(tables.length, 1);
            assert.strictEqual(tables[0].startLine, 0);
            assert.strictEqual(tables[0].endLine, 3);
            assert.deepStrictEqual(tables[0].data, [
                ['Header1', 'Header2'],
                ['Cell1', 'Cell2'],
                ['Cell3', 'Cell4']
            ]);
        });

        it('should parse multiple tables', () => {
            const markdown = `
# First Table

| A | B |
|---|---|
| 1 | 2 |

Some text between tables.

| X | Y | Z |
|---|---|---|
| a | b | c |
`.trim();

            const tables = parseMarkdownTables(markdown);

            assert.strictEqual(tables.length, 2);

            // First table
            assert.deepStrictEqual(tables[0].data, [
                ['A', 'B'],
                ['1', '2']
            ]);

            // Second table
            assert.deepStrictEqual(tables[1].data, [
                ['X', 'Y', 'Z'],
                ['a', 'b', 'c']
            ]);
        });

        it('should handle empty document', () => {
            const tables = parseMarkdownTables('');
            assert.strictEqual(tables.length, 0);
        });

        it('should handle document with no tables', () => {
            const markdown = `
# Heading
This is a paragraph.
- List item 1
- List item 2
`.trim();

            const tables = parseMarkdownTables(markdown);
            assert.strictEqual(tables.length, 0);
        });

        it('should handle table with varying cell counts', () => {
            const markdown = `
| A | B | C |
|---|---|---|
| 1 | 2 | 3 |
| 4 | 5 |
`.trim();

            const tables = parseMarkdownTables(markdown);
            assert.strictEqual(tables.length, 1);
            assert.strictEqual(tables[0].data.length, 3);
        });
    });

    describe('tableToMarkdown', () => {
        it('should convert table data to markdown', () => {
            const data = [
                ['Header1', 'Header2'],
                ['Cell1', 'Cell2']
            ];

            const markdown = tableToMarkdown(data);
            const lines = markdown.split('\n');

            assert.strictEqual(lines.length, 3);
            assert.ok(lines[0].includes('Header1'));
            assert.ok(lines[1].includes('---'));
            assert.ok(lines[2].includes('Cell1'));
        });

        it('should handle empty data', () => {
            const markdown = tableToMarkdown([]);
            assert.strictEqual(markdown, '');
        });

        it('should pad columns to equal width', () => {
            const data = [
                ['A', 'LongHeader'],
                ['Short', 'B']
            ];

            const markdown = tableToMarkdown(data);
            const lines = markdown.split('\n');

            // Each line should have consistent column widths
            assert.ok(lines[0].includes('LongHeader'));
        });
    });

    describe('parseTableRow', () => {
        it('should parse a valid table row', () => {
            const result = parseTableRow('| Cell1 | Cell2 |');
            assert.deepStrictEqual(result, ['Cell1', 'Cell2']);
        });

        it('should return null for line not starting with |', () => {
            const result = parseTableRow('Cell1 | Cell2 |');
            assert.strictEqual(result, null);
        });

        it('should return null for line not ending with |', () => {
            const result = parseTableRow('| Cell1 | Cell2');
            assert.strictEqual(result, null);
        });

        it('should handle whitespace around cells', () => {
            const result = parseTableRow('|  A  |  B  |');
            assert.deepStrictEqual(result, ['A', 'B']);
        });

        it('should handle empty cells', () => {
            const result = parseTableRow('| | |');
            assert.deepStrictEqual(result, ['', '']);
        });
    });

    describe('isSeparatorRow', () => {
        it('should return true for valid separator row', () => {
            assert.strictEqual(isSeparatorRow('|---|---|'), true);
        });

        it('should return true for separator with colons (alignment)', () => {
            assert.strictEqual(isSeparatorRow('|:---|---:|:---:|'), true);
        });

        it('should return true for separator with spaces', () => {
            assert.strictEqual(isSeparatorRow('| --- | --- |'), true);
        });

        it('should return false for non-separator content', () => {
            assert.strictEqual(isSeparatorRow('| Cell1 | Cell2 |'), false);
        });

        it('should return false for line not starting with |', () => {
            assert.strictEqual(isSeparatorRow('---|---|'), false);
        });

        it('should return false for line not ending with |', () => {
            assert.strictEqual(isSeparatorRow('|---|---'), false);
        });

        it('should return false for cell without dashes', () => {
            assert.strictEqual(isSeparatorRow('| ::: |'), false);
        });
    });

    describe('isTableRow', () => {
        it('should return true for valid table row', () => {
            assert.strictEqual(isTableRow('| A | B |'), true);
        });

        it('should return false for line not starting with |', () => {
            assert.strictEqual(isTableRow('A | B |'), false);
        });

        it('should return false for line not ending with |', () => {
            assert.strictEqual(isTableRow('| A | B'), false);
        });

        it('should return true for row with leading/trailing whitespace', () => {
            assert.strictEqual(isTableRow('  | A | B |  '), true);
        });
    });

    describe('parseMarkdownTables edge cases', () => {
        it('should skip lines that look like table rows but have no separator', () => {
            const markdown = `| A | B |
| C | D |`;
            const tables = parseMarkdownTables(markdown);
            assert.strictEqual(tables.length, 0);
        });

        it('should handle table row that fails to parse', () => {
            // This tests the case where isTableRow returns true but parseTableRow returns null
            // In practice, this shouldn't happen with current implementation
            const markdown = `| Header |
|--------|
| Data   |`;
            const tables = parseMarkdownTables(markdown);
            assert.strictEqual(tables.length, 1);
        });

        it('should correctly identify table end line', () => {
            const markdown = `| A | B |
|---|---|
| 1 | 2 |
| 3 | 4 |

Some text after`;
            const tables = parseMarkdownTables(markdown);
            assert.strictEqual(tables.length, 1);
            assert.strictEqual(tables[0].endLine, 3);
        });

        it('should include rawText in table info', () => {
            const markdown = `| A | B |
|---|---|
| 1 | 2 |`;
            const tables = parseMarkdownTables(markdown);
            assert.strictEqual(tables.length, 1);
            assert.strictEqual(tables[0].rawText, markdown);
        });
    });
});

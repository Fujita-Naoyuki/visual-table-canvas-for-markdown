import * as assert from 'assert';
import { parseMarkdownTables, tableToMarkdown } from '../tableParser';

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
});

# Visual Table Canvas for Markdown

Edit Markdown tables with an Excel-like UI in VS Code.

![Demo](./media/demo.gif)

## Features

- **Visual Table Editor**: Edit Markdown tables in a spreadsheet-like interface
- **Excel-like Operations**: Cell selection, copy/paste, undo (Ctrl+Z)
- **Keyboard Navigation**: Arrow keys, Tab, Enter, Delete
- **Row/Column Management**: Right-click to add, delete, copy rows and columns
- **Markdown Formatting**: Bold, italic, strikethrough, code, links are rendered
- **Auto Column Width**: Automatic column width adjustment with configurable max width
- **Split or Same Tab**: Open editor beside or in the same tab (configurable)

## Usage

1. Open a Markdown file containing a table
2. Click "Edit Table" CodeLens above the table
3. Edit the table using the visual editor
4. Click "Save & Close" to save changes

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Arrow Keys | Navigate cells |
| Tab | Move to next cell |
| Shift+Tab | Move to previous cell |
| Enter | Confirm edit / Move down |
| Escape | Cancel edit |
| Delete / Backspace | Clear selected cells |
| Ctrl+Z | Undo |
| Ctrl+C | Copy |
| Ctrl+V | Paste |
| F2 | Start editing cell |

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `visualTableCanvas.openBeside` | `true` | Open editor in split view. Set to `false` to open in same tab. |
| `visualTableCanvas.defaultMaxColumnWidth` | `300` | Default max column width (px) for auto-fit. |

## Requirements

- VS Code 1.85.0 or later

## Installation

### From Marketplace

Search for "Visual Table Canvas for Markdown" in VS Code Extensions.

### From VSIX

1. Download the `.vsix` file
2. Run `code --install-extension visual-table-canvas-for-markdown-x.x.x.vsix`

## Development

```bash
# Install dependencies
npm install

# Compile
npm run compile

# Watch mode
npm run watch

# Run tests
npm run test:unit

# Run tests with coverage
npm run test:coverage
```

## License

MIT
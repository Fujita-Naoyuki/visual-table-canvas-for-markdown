# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.8.0] - 2026-02-01

### Added

- Zoom Slider: Excel-like zoom control in status bar (50% - 200%)
  - Slider for smooth zoom adjustment
  - +/- buttons for 10% step zoom
  - Percentage display

### Changed

- Reduced minimum cell width from 60px to 25px (fits 2 alphanumeric characters)

## [0.7.0] - 2026-01-16

### Added

- Vertical Cell Merge using `^` notation
  - Enter `^` in a cell to visually merge with the cell above
  - Border between merged cells is hidden
  - Use `\^` to display literal `^` character
  - Multiple consecutive `^` cells form one large merged cell

### Changed

- Table saving now preserves original formatting for unchanged rows (minimizes diffs)

### Fixed

- Pipe character (`|`) in cells now properly escaped/unescaped to prevent table corruption

## [0.6.1] - 2026-01-15

### Fixed

- `Escape` key now closes context menus and insert row/column dialogs

## [0.6.0] - 2026-01-15

### Added

- Find and Replace functionality
  - `Ctrl+F` to open find dialog
  - `Ctrl+H` to open find and replace dialog
  - `Enter` / `Shift+Enter` to navigate between matches
  - Match Case toggle (`Aa` button)
  - Replace / Replace All with undo support
  - `Escape` to close dialog

## [0.5.0] - 2026-01-15

### Added

- Ctrl++ shortcut to insert row(s) above / column(s) left (when header selected)
- Ctrl+- shortcut to delete selected row(s) / column(s) (when header selected)

### Fixed

- Cells at bottom row overlapping with horizontal scrollbar when navigating with arrow keys

## [0.4.0] - 2026-01-14

### Added

- Ctrl+Arrow keys for Excel-like data boundary jump navigation
- Freeze First Row: Pin the first data row as a sticky header (toolbar checkbox)

## [0.3.0] - 2026-01-14

### Added

- Excel/Spreadsheet copy & paste integration
  - Copy cells to Excel/Google Sheets (TSV format)
  - Paste from Excel/Google Sheets
  - `<br>` ↔ line break conversion for cell-internal newlines
- Shift+Click to extend cell selection range

## [0.2.0] - 2026-01-13

### Added

- Shift+Enter inserts `<br>` in edit mode (same as Alt+Enter)
- Shift+Click on row/column headers extends selection range
- Redo functionality (Ctrl+Y)

### Fixed

- Status bar being cut off at the bottom of the screen

## [0.1.0] - 2026-01-13

### Added

- Text formatting shortcuts in edit mode
  - Ctrl+B: Toggle bold (`**text**`)
  - Ctrl+I: Toggle italic (`*text*`)
  - Ctrl+5: Toggle strikethrough (`~~text~~`)
  - Ctrl+Shift+C: Toggle code (`` `text` ``)
  - Ctrl+V: Paste as link when clipboard contains URL
- Status bar hints for edit mode shortcuts

### Fixed

- Long text overflowing into adjacent cells (added word-break)
- Paste as link timing issue with async clipboard API
- Textarea not auto-resizing after paste as link
- Arrow key navigation not scrolling viewport to keep selected cell visible
- Context menu appearing outside visible viewport
- Column headers (A, B, C...) transparent background causing overlap when scrolling
- Row headers (1, 2, 3...) transparent background causing overlap when scrolling

### Changed

- Edit mode now places cursor at end instead of selecting all text
- Status bar format improved with `·` separator and `→` arrows

## [0.0.1] - 2026-01-11

### Added

- Initial release
- Visual table editor with Excel-like UI
- Cell selection (single and range)
- Row selection (click row header)
- Column selection (click column header)
- Keyboard navigation (Arrow keys, Tab, Enter)
- Cell editing (double-click or F2)
- Copy/Paste operations (Ctrl+C, Ctrl+V)
- Undo functionality (Ctrl+Z)
- Delete/Clear selected cells (Delete/Backspace)
- Row operations via context menu
  - Insert row above/below
  - Delete row(s)
  - Copy/Paste row(s)
- Column operations via context menu
  - Insert column left/right
  - Delete column(s)
  - Copy/Paste column(s)
- Auto column width adjustment
- Markdown formatting preview (bold, italic, code, links, etc.)
- Save & Close button
- Configuration settings
  - Open beside or in same tab
  - Default max column width
- CodeLens integration for easy table editing

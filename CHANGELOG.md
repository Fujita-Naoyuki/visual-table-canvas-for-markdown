# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

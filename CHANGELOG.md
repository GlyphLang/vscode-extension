# Changelog

All notable changes to the Glyph Language Support extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.3] - 2025-01-07

### Added

- Initial release of Glyph Language Support for VS Code
- Syntax highlighting for `.glyph` and `.glybc` files
- Language Server Protocol (LSP) client integration
- Configuration options:
  - `glyph.lsp.path` - Path to the Glyph LSP server executable
  - `glyph.lsp.logFile` - Path to LSP log file for debugging
  - `glyph.compiler.optimizationLevel` - Compiler optimization level (O0-O3)
  - `glyph.diagnostics.showOptimizerHints` - Toggle optimizer hints in diagnostics
- Language configuration for bracket matching, comments, and auto-closing pairs

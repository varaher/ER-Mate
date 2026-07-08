---
name: PDFKit unicode glyphs
description: Non-ASCII characters render as garbled glyphs in PDFKit-generated PDFs unless a custom font with the right glyph coverage is embedded.
---

## The problem
PDFKit's built-in standard fonts (Helvetica, Helvetica-Oblique, etc.) only support the WinAnsi/Latin1 subset. Characters outside that range — e.g. the arrow "→" (U+2192) — render as garbled/mojibake glyphs (e.g. "!'") in the output PDF instead of throwing an error, so the bug is easy to miss without opening the actual PDF or running `pdftotext` on it.

**Why:** No exception is thrown; the PDF just silently contains wrong glyphs. Visual/text-extraction verification is required to catch it — `tsc` and server logs won't reveal it.

**How to apply:** When writing PDFKit `.text()` calls with dynamic/templated strings, avoid Unicode symbols (arrows, checkmarks, bullets beyond `•`, em-dashes if unsure) in default-font documents. Prefer plain ASCII substitutes (e.g. "->" instead of "→"). If Unicode glyphs are required, embed a font that covers them (e.g. `doc.font('path/to/NotoSans.ttf')`) rather than relying on PDFKit's standard fonts. Always spot-check generated PDFs with `pdftotext` after adding new templated text.

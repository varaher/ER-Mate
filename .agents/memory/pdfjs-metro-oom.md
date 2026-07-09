---
name: PDF.js Metro OOM fix
description: Large PDF.js .txt assets required() in PdfPreviewScreen caused Metro iOS/Android OOM; fix is CDN script src in WebView HTML
---

## Rule
Never `require()` large binary/minified assets (>100 KB) inside React Native components. Even with .txt extension, Metro bundles require()'d files inline into every platform bundle, causing OOM.

## Why
`assets/pdfjs/pdf.worker.min.txt` (1.07 MB) + `pdf.min.txt` (320 KB) were loaded via `Asset.fromModule(require(...))` in PdfPreviewScreen. Metro embedded them inline, causing iOS/Android bundling to fail at ~1695 modules with an OOM error. Build time was ~2.7s before crash. Web didn't fail because web bundles skip React Native asset processing.

## How to apply
For large JS libraries needed inside a WebView:
- Use `<script src="https://cdn.jsdelivr.net/npm/...">` inside the inline HTML string
- Set `baseUrl` on the WebView source and `mixedContentMode="always"` on Android
- Remove `require()` calls and the Asset/FileSystem load functions
- The CDN script tag approach loads the library at WebView runtime, NOT at Metro bundle time

## CDN used
`https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js` (main)
`https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js` (worker)
The .txt files in assets/pdfjs/ are kept but no longer required().

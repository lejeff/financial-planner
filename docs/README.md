# docs/

Generated architecture documentation for the Financial Planner project.

## Files

| File                | Role                                                  |
| ------------------- | ----------------------------------------------------- |
| `architecture.md`   | **Source of truth**. Edit this and rebuild the rest.  |
| `architecture.pdf`  | Generated PDF artifact (A4, print-ready).             |
| `architecture.html` | Generated self-contained HTML (inline CSS + SVG).     |
| `architecture.css`  | Shared stylesheet used by both outputs.               |

The build script lives at [`scripts/docs-build.cjs`](../scripts/docs-build.cjs).
It uses `marked` to render markdown, runs mermaid.js inside headless Chromium
via Puppeteer to convert diagrams to inline SVG, then emits both a
self-contained HTML file and an A4 PDF.

## Regenerating

From the repo root:

```bash
# One-time: download the Chromium binary Puppeteer uses (~/.cache/puppeteer).
# Skip if you already have it from a previous project — the script will pick
# it up automatically.
npm run docs:setup

# Rebuild both architecture.pdf and architecture.html from architecture.md.
npm run docs:build
```

Commit all three files together (`.md`, `.pdf`, `.html`) so readers without
Node installed can still open the rendered versions directly.

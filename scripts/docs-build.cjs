#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Build docs/architecture.{pdf,html} from docs/architecture.md.
 *
 * Flow:
 *   1. Parse the markdown with `marked` (GFM on). Fenced ```mermaid blocks are
 *      emitted as <div class="mermaid">…</div> and fenced ```sql/ts/json etc.
 *      fall through to the default renderer.
 *   2. Launch Puppeteer (uses the Chrome already in ~/.cache/puppeteer; run
 *      `npm run docs:setup` once if it's missing).
 *   3. Load the rendered HTML into the page with mermaid.js from jsDelivr,
 *      run mermaid.run() to turn every `<div class="mermaid">` into inline SVG.
 *   4. Snapshot the DOM back out and write it as docs/architecture.html
 *      (self-contained — inline CSS + inline SVG + no external dependencies).
 *   5. Call `page.pdf()` with A4 margins and a small header/footer and write
 *      docs/architecture.pdf.
 *
 * Why not md-to-pdf? We tried it first. On this machine `md-to-pdf` hung
 * indefinitely inside its default `waitUntil: networkidle0` pathway — even on
 * a trivial input. Owning the render loop directly is ~40 lines and lets us
 * pick `load` as the readiness signal.
 */

const fs = require("node:fs");
const path = require("node:path");
const { marked } = require("marked");
const puppeteer = require("puppeteer");

const repoRoot = path.resolve(__dirname, "..");
const docsDir = path.join(repoRoot, "docs");
const mdPath = path.join(docsDir, "architecture.md");
const cssPath = path.join(docsDir, "architecture.css");
const pdfOut = path.join(docsDir, "architecture.pdf");
const htmlOut = path.join(docsDir, "architecture.html");

marked.use({
  gfm: true,
  breaks: false,
  renderer: {
    code({ text, lang }) {
      if ((lang || "").toLowerCase() === "mermaid") {
        // mermaid.js wants the raw source as textContent, preserving
        // whitespace. Escape &, <, > so the source isn't misparsed as HTML.
        const escaped = text
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
        return `<div class="mermaid">${escaped}</div>\n`;
      }
      return false; // fall through to marked's default code renderer
    }
  }
});

function buildHtmlPage(bodyHtml, css) {
  // Mermaid is pulled from jsDelivr once, then we snapshot the rendered DOM
  // and strip the <script> before writing the file — the saved HTML is fully
  // self-contained and won't try to re-fetch mermaid when opened offline.
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Financial Planner — Architecture</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>${css}</style>
  <script type="module" id="mermaid-bootstrap">
    import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";
    mermaid.initialize({ startOnLoad: false, theme: "neutral", securityLevel: "strict", flowchart: { htmlLabels: true } });
    window.__mermaidReady = mermaid.run({ querySelector: ".mermaid" }).then(() => {
      window.__mermaidDone = true;
    }).catch((err) => {
      console.error("mermaid error", err);
      window.__mermaidDone = true; // unblock even on diagram error
    });
  </script>
</head>
<body class="architecture-doc">
${bodyHtml}
</body>
</html>
`;
}

async function main() {
  console.log("[docs] reading", path.relative(repoRoot, mdPath));
  const md = fs.readFileSync(mdPath, "utf8");
  const css = fs.readFileSync(cssPath, "utf8");
  const bodyHtml = marked.parse(md);
  const page1 = buildHtmlPage(bodyHtml, css);

  console.log("[docs] launching puppeteer...");
  const browser = await puppeteer.launch({
    args: ["--no-sandbox"]
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 1600, deviceScaleFactor: 2 });

    console.log("[docs] loading HTML + mermaid...");
    await page.setContent(page1, { waitUntil: "load", timeout: 60000 });

    await page.waitForFunction(() => window.__mermaidDone === true, { timeout: 60000 });
    console.log("[docs] mermaid diagrams rendered");

    // Strip the mermaid bootstrap script so the saved HTML doesn't re-run
    // mermaid on every open (the SVGs are already inlined).
    await page.evaluate(() => {
      const s = document.getElementById("mermaid-bootstrap");
      if (s) s.remove();
      // Defensive: mermaid sometimes leaves a dark-theme class on <body>.
      document.body.classList.remove("mermaid-dark");
    });

    const renderedHtml = await page.evaluate(() => `<!doctype html>\n${document.documentElement.outerHTML}\n`);
    fs.writeFileSync(htmlOut, renderedHtml, "utf8");
    console.log("[docs] wrote", path.relative(repoRoot, htmlOut), `(${(renderedHtml.length / 1024).toFixed(1)} KB)`);

    console.log("[docs] generating PDF...");
    await page.emulateMediaType("print");
    await page.pdf({
      path: pdfOut,
      format: "A4",
      printBackground: true,
      margin: { top: "18mm", right: "16mm", bottom: "20mm", left: "16mm" },
      displayHeaderFooter: true,
      headerTemplate:
        '<div style="font-size:9px;color:#888;width:100%;padding:4px 16mm 0;">' +
        "<span>Financial Planner — Architecture</span></div>",
      footerTemplate:
        '<div style="font-size:9px;color:#888;width:100%;padding:0 16mm 4px;text-align:right;">' +
        '<span class="pageNumber"></span> / <span class="totalPages"></span></div>'
    });
    const stat = fs.statSync(pdfOut);
    console.log("[docs] wrote", path.relative(repoRoot, pdfOut), `(${(stat.size / 1024).toFixed(1)} KB)`);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

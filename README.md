# tweakpele

Pele theme & render playground (React + esbuild).

## Focused diagram view

The **focused diagram view** (click a gallery card, or gallery 1×1) has the Pele playground's Pele / Mermaid / SVG / Compare switch and **Copy SVG** (copies the Pele output). Compare has a **Compatible theme** toggle on the Mermaid side (off by default; uses the exported mermaid.config.json theme). The compatible theme and the Mermaid exports (mermaid.config.json, Mermaid frontmatter, Copy source with Mermaid theme) also carry Pele render options that Mermaid 12.1.0 has under the same name (flowchart curve / spacing / wrapping, per-diagram sizes, `fontSize`); options without a Mermaid equivalent (padding, maxWidth, responsive, autoDirection, directionBreakpoint, monospace, now, zoom, treemap) are skipped. With the compatible theme on, an **ELK / dagre** switch picks the Mermaid layout engine: ELK (Mermaid's default) ignores curve, nodeSpacing and rankSpacing; dagre applies them. The Mermaid exports add `layout: dagre` only while dagre is picked. Layouts are similar, not identical, because the layout engines differ. Mermaid and Compare load stock Mermaid 12.1.0 from jsDelivr on first use (needs network). Zoom, C4 selection, and the style panels stay on the Pele view; the other views are read-only.

## Preview Markdown

The **Markdown preview** button in the top bar (or `#/md`) opens a local `.md` file by file picker or drag-and-drop. Prose renders as HTML; every ` ```mermaid ` block renders with the current tweakpele theme and follows the toolbox live. The image lines `tweakpele render` inserts are hidden, since the live diagram replaces them. The last opened file is kept in the browser across reloads.

## Render Markdown diagrams

Render the ` ```mermaid ` blocks of local Markdown files to standalone SVGs with your tweakpele theme, so docs viewed in VS Code or plain Markdown look exactly like tweakpele:

```
tweakpele render <files or dirs...> --theme <theme.tweakpele.json> [--out-dir diagrams] [--transparent] [--check] [--chrome <path>]
```

Without cloning: `npx github:hanxiaomax/tweakpele render docs --theme theme.tweakpele.json`. In a clone: `node cli/tweakpele.mjs render ...`.

- Get the theme file from the app: the **Download theme file** button in tweakpele's top bar.
- Each diagram is written to `<out-dir>/<hash>.svg` (relative to the Markdown file) and an image line `![](diagrams/<hash>.svg)` is inserted right after the block.
- Diagrams are rendered in your installed Chrome (or Edge) so text is measured with real fonts, exactly like tweakpele. Use `--chrome <path>` or `TWEAKPELE_CHROME` for another binary; with no browser it falls back to Pele in Node, where text widths are estimated.
- The code block stays in place, so GitHub and Mermaid viewers still see the source. Re-running only rewrites what changed; old SVGs are listed, never deleted.
- `--check` writes nothing and exits 1 when anything would change — handy for CI.

## Bring your own API key

The focused diagram view has an **AI chat** panel (sparkles button in the title bar): describe a diagram to create, or ask for a change to the current one. When a reply contains a Mermaid block, **一键应用** writes it into the editor like a normal edit. It uses your own OpenAI-compatible API key — defaults are base URL `https://api.openai.com/v1` and model `gpt-4o`, both changeable in the panel's settings. The key is held in memory only and forgotten on reload unless **记住这台设备** is checked (then it lives in this browser's localStorage). tweakpele has no backend: the key is sent straight from your browser to the base URL you set and nowhere else. Official APIs often reject direct browser calls (CORS); if requests fail, point the base URL at a CORS-enabled endpoint you trust.

## Development

```
npm install
npm run build   # esbuild bundle
npm run check   # verify diagram overrides
```

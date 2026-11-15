# tweakpele

Pele theme & render playground (React + esbuild).

## Preview Markdown

The **Markdown preview** button in the top bar (or `#/md`) opens a local `.md` file by file picker or drag-and-drop. Prose renders as HTML; every ` ```mermaid ` block renders with the current tweakpele theme and follows the toolbox live. The image lines `tweakpele render` inserts are hidden, since the live diagram replaces them. The last opened file is kept in the browser across reloads. Each diagram has the Pele playground's Pele / Mermaid / SVG / Compare switch; Mermaid and Compare load stock Mermaid 12.1.0 from jsDelivr on first use (needs network).

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

## Development

```
npm install
npm run build   # esbuild bundle
npm run check   # verify diagram overrides
```

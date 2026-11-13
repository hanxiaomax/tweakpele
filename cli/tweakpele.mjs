#!/usr/bin/env node
// tweakpele render — render ```mermaid blocks of Markdown files to standalone themed SVGs.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { FACTORY } from '../src/constants.js';

const PELE_GLOBAL = fileURLToPath(new URL('../vendor/pele.global.js', import.meta.url));

const USAGE = 'usage: tweakpele render <files or dirs...> --theme <theme.tweakpele.json> [--out-dir diagrams] [--transparent] [--check] [--chrome <path>]';

const rel = (p) => path.relative(process.cwd(), p) || '.';
const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function failUsage(msg) {
  console.error(USAGE);
  if (msg) console.error('error: ' + msg);
  process.exit(2);
}

function parseArgs(argv) {
  const out = { paths: [], theme: null, outDir: 'diagrams', transparent: false, check: false, chrome: process.env.TWEAKPELE_CHROME || null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const val = () => {
      const v = argv[++i];
      if (!v || v.startsWith('-')) failUsage(`${a} requires a value`);
      return v;
    };
    if (a === '--theme') out.theme = val();
    else if (a === '--out-dir') out.outDir = val();
    else if (a === '--chrome') out.chrome = val();
    else if (a === '--transparent') out.transparent = true;
    else if (a === '--check') out.check = true;
    else if (a === '--help' || a === '-h') { console.log(USAGE); process.exit(0); }
    else if (a.startsWith('--')) failUsage(`unknown flag ${a}`);
    else out.paths.push(a);
  }
  if (!out.paths.length) failUsage('no files or directories given');
  if (!out.theme) failUsage('--theme is required');
  return out;
}

// Recursively collect *.md, skipping node_modules and dot-directories.
function walkMd(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      walkMd(path.join(dir, e.name), out);
    } else if (e.isFile() && e.name.endsWith('.md')) out.push(path.join(dir, e.name));
  }
  return out;
}

function loadTheme(p) {
  let raw;
  try { raw = fs.readFileSync(p, 'utf8'); } catch { console.error(`error: cannot read theme file: ${p}`); process.exit(1); }
  let data;
  try { data = JSON.parse(raw); } catch (e) { console.error(`error: invalid theme file ${p}: ${e.message}`); process.exit(1); }
  if (!data || typeof data !== 'object' || Array.isArray(data)
    || !data.vars || typeof data.vars !== 'object' || Array.isArray(data.vars)) {
    console.error(`error: invalid theme file ${p}: expected { version, vars: { "--pele-*": string }, options? }`);
    process.exit(1);
  }
  const vars = { ...FACTORY };
  for (const [k, v] of Object.entries(data.vars)) if (typeof v === 'string' && v.trim()) vars[k] = v.trim();
  // Values get inlined into style="..." attributes, so double quotes must not survive.
  for (const k of Object.keys(vars)) vars[k] = vars[k].replace(/"/g, "'");
  const options = data.options && typeof data.options === 'object' && !Array.isArray(data.options) ? data.options : {};
  return { raw, vars, options };
}

// pele.render options from the theme file: drop browser-only keys, sync fonts with vars.
function renderOptions(theme) {
  const o = { ...theme.options };
  delete o.zoom;
  o.responsive = false;
  if (typeof o.now === 'string') o.now = new Date(o.now + 'T12:00:00');
  if (!o.fontFamily) o.fontFamily = theme.vars['--pele-font'];
  if (!o.fontFamilyMono) o.fontFamilyMono = theme.vars['--pele-font-mono'];
  return o;
}

// Resolve var(--x, fallback) against the theme (plus root-svg custom props) and add the bg rect.
function standaloneSvg(svg, vars, transparent) {
  const v = { ...vars };
  // Font fallbacks arrive as &quot;…&quot;; decode first so splitting on ';' keeps them whole.
  const rootStyle = ((svg.match(/^<svg[^>]*style="([^"]*)"/) || [])[1] || '').replace(/&quot;/g, "'");
  for (const decl of rootStyle.split(';')) {
    const m = decl.match(/^\s*(--[\w-]+)\s*:\s*(.+)$/);
    if (m && !(m[1] in v)) v[m[1]] = m[2].trim();
  }
  const resolve = (s, depth = 0) => (depth > 10 ? s : s.replace(
    /var\((--[\w-]+)\s*(?:,\s*((?:[^()]|\([^()]*\))*))?\)/g,
    (_, name, fb) => resolve(v[name] ?? (fb !== undefined ? fb.trim() : ''), depth + 1),
  ));
  for (const k of Object.keys(v)) v[k] = resolve(v[k]);
  let out = svg.replace(/max-width:100%;height:auto;/, '');
  for (let i = 0; i < 5 && /var\(--/.test(out); i++) out = resolve(out);
  if (!transparent) {
    const vb = (out.match(/viewBox="([^"]+)"/) || [])[1];
    if (vb) {
      const [x, y, w, h] = vb.split(/\s+/);
      out = out.replace(/(<svg[^>]*>)/, `$1<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${v['--pele-bg'] || '#fff'}"/>`);
    }
  }
  return { svg: out, unresolved: /var\(--/.test(out) };
}

// Fenced ```mermaid blocks: ``` or ~~~ fences (>=3 chars, <=3 spaces indent), exact info string.
function findBlocks(lines) {
  const blocks = [];
  const fence = /^ {0,3}(`{3,}|~{3,})(.*)$/;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(fence);
    if (!m || m[2].trim() !== 'mermaid') continue;
    const ch = m[1][0];
    const len = m[1].length;
    const indent = lines[i].length - lines[i].trimStart().length;
    const close = new RegExp(`^ {0,3}${ch === '`' ? '`' : '~'}{${len},}\\s*$`);
    let j = i + 1;
    while (j < lines.length && !close.test(lines[j])) j++;
    if (j >= lines.length) continue;
    const dedent = new RegExp(`^ {0,${indent}}`);
    blocks.push({ line: i + 1, closeIdx: j, source: lines.slice(i + 1, j).map((l) => l.replace(dedent, '')).join('\n') });
    i = j;
  }
  return blocks;
}

// Ensure exactly one image line after the closing fence; replace a stale one, else insert.
function updateImageLine(lines, closeIdx, img, imgRe) {
  const isImg = (l) => imgRe.test(l.trim());
  const j = closeIdx + 1;
  let t = -1;
  if (j < lines.length && isImg(lines[j])) t = j;
  else if (j < lines.length && lines[j].trim() === '' && j + 1 < lines.length && isImg(lines[j + 1])) t = j + 1;
  if (t >= 0) {
    if (lines[t] === img) return false;
    lines[t] = img;
    return true;
  }
  lines.splice(closeIdx + 1, 0, '', img);
  return true;
}

// Render in Chrome so text is measured with real fonts, exactly as tweakpele does; Node estimates widths.
async function openRenderer(chromePath, opts) {
  const { chromium } = await import('playwright-core');
  const tries = chromePath ? [{ executablePath: chromePath }] : [{ channel: 'chrome' }, { channel: 'msedge' }, { channel: 'chromium' }];
  let browser;
  for (const t of tries) {
    try { browser = await chromium.launch({ ...t, args: ['--no-sandbox'] }); break; } catch (e) {
      if (chromePath) { console.error(`error: cannot launch Chrome at ${chromePath}: ${e.message.split('\n')[0]}`); process.exit(2); }
    }
  }
  if (!browser) {
    console.error('warning: no Chrome found (pass --chrome <path>); text widths are estimated and may not match tweakpele');
    const { render, PeleError } = await import('pele');
    return {
      render: async (src) => {
        try { return render(src, opts); } catch (e) {
          if (e instanceof PeleError) return { error: `${e.code ? `[${e.code}] ` : ''}${e.message}` };
          throw e;
        }
      },
      close: async () => {},
    };
  }
  const page = await browser.newPage();
  await page.addScriptTag({ path: PELE_GLOBAL });
  return {
    render: (src) => page.evaluate(([s, o]) => {
      if (o.now) o.now = new Date(o.now);
      try { return pele.render(s, o); } catch (e) {
        if (e instanceof pele.PeleError) return { error: `${e.code ? `[${e.code}] ` : ''}${e.message}` };
        throw e;
      }
    }, [src, { ...opts, now: opts.now?.toISOString() }]),
    close: () => browser.close(),
  };
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv[0] !== 'render') failUsage(argv.length ? `unknown command "${argv[0]}"` : 'missing "render" command');
  const args = parseArgs(argv.slice(1));
  const theme = loadTheme(args.theme);
  const opts = renderOptions(theme);

  const renderer = await openRenderer(args.chrome, opts);

  const files = [];
  for (const p of args.paths) {
    let st;
    try { st = fs.statSync(p); } catch { console.error(`error: not found: ${p}`); process.exit(2); }
    if (st.isDirectory()) files.push(...walkMd(p));
    else files.push(p);
  }
  if (!files.length) console.error('warning: no Markdown files found');

  const outDirRef = args.outDir.split(path.sep).join('/');
  const imgRe = new RegExp(`^!\\[\\]\\(${reEsc(outDirRef)}/[0-9a-f]{10}\\.svg\\)$`);
  const anyImgRe = new RegExp(`^!\\[\\]\\(${reEsc(outDirRef)}/([^/\\s)]+\\.svg)\\)$`);

  let failures = 0;
  const mdChanges = [];
  const svgChanges = [];
  const outDirs = new Map(); // abs out-dir -> Set of referenced svg filenames

  for (const md of [...new Set(files)]) {
    const text = fs.readFileSync(md, 'utf8');
    const eol = text.includes('\r\n') ? '\r\n' : '\n';
    const lines = text.split(/\r?\n/);
    const blocks = findBlocks(lines);
    const outDirAbs = path.resolve(path.dirname(md), args.outDir);
    if (!outDirs.has(outDirAbs)) outDirs.set(outDirAbs, new Set());
    let updated = 0;
    let shift = 0;

    for (const b of blocks) {
      const result = await renderer.render(b.source);
      if (result.error) {
        console.error(`${rel(md)}:${b.line}: ${result.error}`);
        failures++;
        continue;
      }
      const { svg, unresolved } = standaloneSvg(result.svg, theme.vars, args.transparent);
      if (unresolved) console.error(`warning: ${rel(md)}:${b.line}: unresolved CSS variables remain in SVG`);
      const hash = crypto.createHash('sha256').update(theme.raw).update(b.source).digest('hex').slice(0, 10);
      const svgPath = path.join(outDirAbs, `${hash}.svg`);
      const same = fs.existsSync(svgPath) && fs.readFileSync(svgPath, 'utf8') === svg;
      if (!same) {
        svgChanges.push(svgPath);
        if (!args.check) {
          fs.mkdirSync(outDirAbs, { recursive: true });
          fs.writeFileSync(svgPath, svg);
        }
      }
      const lenBefore = lines.length;
      if (updateImageLine(lines, b.closeIdx + shift, `![](${outDirRef}/${hash}.svg)`, imgRe)) updated++;
      shift += lines.length - lenBefore;
    }

    const newText = lines.join(eol);
    if (newText !== text) {
      mdChanges.push(md);
      if (!args.check) fs.writeFileSync(md, newText);
    }
    for (const l of lines) {
      const m = l.trim().match(anyImgRe);
      if (m) outDirs.get(outDirAbs).add(m[1]);
    }
    console.log(`${rel(md)}: ${blocks.length} diagrams${blocks.length ? ` (${updated} updated)` : ''}`);
  }

  await renderer.close();
  if (!args.check) {
    for (const [dir, refd] of outDirs) {
      if (!fs.existsSync(dir)) continue;
      const stale = fs.readdirSync(dir).filter((f) => f.endsWith('.svg') && !refd.has(f));
      if (stale.length) console.log(`note: unreferenced in ${rel(dir)}: ${stale.sort().join(', ')}`);
    }
  } else {
    for (const p of mdChanges) console.log(`would change: ${rel(p)}`);
    for (const p of svgChanges) console.log(`would change: ${rel(p)}`);
    if (mdChanges.length || svgChanges.length || failures) process.exit(1);
    console.log('up to date');
    return;
  }
  process.exit(failures ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });

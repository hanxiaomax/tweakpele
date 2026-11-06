/** Build src/main.jsx → assets/app.js (committed; GitHub Pages serves it statically). */
import * as esbuild from 'esbuild';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const result = await esbuild.build({
  entryPoints: ['src/main.jsx'],
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['es2019'],
  outfile: 'assets/app.js',
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
  legalComments: 'none',
  metafile: true,
  banner: { js: '/* tweakpele UI — built from src/ with esbuild: npm run build */' },
});

const sizes = {};
for (const [file, info] of Object.entries(result.metafile.outputs)) {
  if (!file.startsWith('assets/')) continue;
  sizes[file] = (info.bytes / 1024).toFixed(1) + ' KB';
}
console.log('built', sizes);

// Bust GitHub Pages CDN/browser cache for CSS/JS after each build.
const jsHash = createHash('sha256').update(readFileSync('assets/app.js')).digest('hex').slice(0, 8);
const cssHash = createHash('sha256').update(readFileSync('tweakpele.css')).digest('hex').slice(0, 8);
let html = readFileSync('index.html', 'utf8');
html = html
  .replace(/href="\.\/tweakpele\.css(?:\?v=[^"]*)?"/, `href="./tweakpele.css?v=${cssHash}"`)
  .replace(/src="\.\/assets\/app\.js(?:\?v=[^"]*)?"/, `src="./assets/app.js?v=${jsHash}"`);
writeFileSync('index.html', html);
console.log('cache-bust', { css: cssHash, js: jsHash });
